import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const password = 'Vardelume-test-only-Password-482!';
const authStatePath = join(process.cwd(), '.agents', 'qa', 'financial-agent-auth-state.json');
const runIdPath = join(process.cwd(), '.agents', 'qa', 'financial-agent-run-id.txt');

async function authError(response: {
  ok(): boolean;
  status(): number;
  json(): Promise<unknown>;
}) {
  if (response.ok()) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') return null;
  const code = 'code' in payload && typeof payload.code === 'string' ? payload.code : null;
  const message =
    'message' in payload && typeof payload.message === 'string' ? payload.message : null;
  return { code, message };
}

async function markVerified(prisma: PrismaClient, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  expect(user, 'el registro público debe crear la cuenta de prueba').not.toBeNull();
  if (!user) throw new Error('No se creó la cuenta de prueba');
  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }
  return user;
}

async function signInFromForm(page: Page, userEmail: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(userEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/sign-in/email',
  );
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  return responsePromise;
}

async function completeSignIn(page: Page, prisma: PrismaClient, userEmail: string) {
  let response = await signInFromForm(page, userEmail);
  let failure = await authError(response);
  if (failure?.code === 'EMAIL_NOT_VERIFIED' || failure?.message === 'Email not verified') {
    await markVerified(prisma, userEmail);
    response = await signInFromForm(page, userEmail);
    failure = await authError(response);
  }
  expect(response.ok(), `Inicio de sesión rechazado: ${failure?.code ?? response.status()}`).toBe(
    true,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectKeyboardFocus(page: Page) {
  const nameInput = page.getByLabel('Nombre', { exact: true });
  const objectiveInput = page.getByLabel('Objetivo', { exact: true });
  await nameInput.focus();
  await page.keyboard.press('Tab');
  await expect(objectiveInput).toBeFocused();
  expect(await objectiveInput.evaluate((input) => input.matches(':focus-visible'))).toBe(true);
}

test('una persona crea, recupera y edita su primer borrador aislado', async (
  { browser, request, baseURL },
  testInfo,
) => {
  const prisma = new PrismaClient();
  const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
  const appBaseURL = baseURL ?? origin;
  const mobile = testInfo.project.name === 'mobile-chromium';
  mkdirSync(dirname(authStatePath), { recursive: true });
  if (!mobile && testInfo.retry === 0) {
    writeFileSync(runIdPath, randomUUID().replaceAll('-', '').slice(0, 16));
  }
  const runId = existsSync(runIdPath) ? readFileSync(runIdPath, 'utf8').trim() : '';
  if (!/^[a-f0-9]{16}$/.test(runId)) {
    throw new Error('No se encontró el identificador sintético del recorrido de escritorio.');
  }
  const email = `financial-agent-${runId}@example.test`;
  const name = `Prueba Vardelume ${runId}`;
  const anotherEmail = `financial-agent-aislamiento-${runId}@example.test`;
  const anotherName = `Prueba de aislamiento ${runId}`;
  const reuseSession = mobile || (testInfo.retry > 0 && existsSync(authStatePath));
  let secondContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  if (!mobile && testInfo.retry === 0) rmSync(authStatePath, { force: true });
  if (!mobile && testInfo.retry > 0 && !reuseSession) rmSync(authStatePath, { force: true });

  try {
    if (mobile && !existsSync(authStatePath)) {
      throw new Error('El proyecto móvil necesita la sesión creada por el recorrido de escritorio.');
    }

    mkdirSync(dirname(authStatePath), { recursive: true });
    context = await browser.newContext({
      baseURL: appBaseURL,
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      ...(mobile ? { isMobile: true, hasTouch: true } : {}),
      ...(reuseSession ? { storageState: authStatePath } : {}),
    });
    if (!mobile && reuseSession) {
      const retryOwner = await prisma.user.findUnique({ where: { email } });
      if (retryOwner) {
        await prisma.financialAgent.deleteMany({ where: { userId: retryOwner.id } });
      }
    }
    const page = await context.newPage();

    if (!mobile && !reuseSession) {
      const anonymousList = await request.get('/api/financial-agents');
      expect(anonymousList.status()).toBe(401);
      const anonymousCreate = await request.post('/api/financial-agents', {
        data: { name: 'No autorizado', objective: 'Prueba', questions: ['¿Prueba?'] },
      });
      expect(anonymousCreate.status()).toBe(401);

      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Crear agente financiero' })).toBeVisible();
      const landingFits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(landingFits).toBe(true);

      await page.getByRole('link', { name: 'Crear agente financiero' }).click();
      await expect(page).toHaveURL(/\/signup$/);
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        await page.getByLabel('Nombre', { exact: true }).fill(name);
        await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
        await page.getByLabel('Contraseña', { exact: true }).fill(password);
        const signupResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === '/api/auth/sign-up/email',
        );
        await page.getByRole('button', { name: 'Crear cuenta' }).click();
        const response = await signupResponse;
        expect(
          response.ok(),
          `Alta rechazada: ${(await authError(response))?.code ?? response.status()}`,
        ).toBe(true);
        await expect(page).toHaveURL(/\/profile$/);
      }

      await completeSignIn(page, prisma, email);
      await context.storageState({ path: authStatePath });
    } else {
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Crear agente financiero' })).toBeVisible();
      const landingFits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(landingFits).toBe(true);
      await page.goto('/dashboard');
    }

    await expect(page.getByRole('heading', { name: 'Configura tu agente financiero' })).toBeVisible();
    await expectKeyboardFocus(page);
    const dashboardFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(dashboardFits).toBe(true);
    const templateButton = page.getByRole('button', {
      name: 'Usar plantilla de evaluación financiera',
      exact: true,
    });
    await expect(templateButton).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: /ejecutar|publicar|documento|revisión|pago/i }),
    ).toHaveCount(0);

    if (mobile) {
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Objetivo', { exact: true })).toHaveValue('');
      await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue('');
      await templateButton.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
        'Evaluación financiera inicial',
      );
      await expect(page.getByRole('textbox', { name: 'Pregunta 3' })).toHaveValue(
        '¿En qué plazo se requiere?',
      );
      const mobileTemplateFits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(mobileTemplateFits).toBe(true);
      const savedDraft = page.getByRole('button', { name: /Evaluación de capital de trabajo/ });
      await expect(savedDraft).toBeVisible();
      await savedDraft.click();
      await expect(page.getByRole('heading', { name: 'Editar borrador' })).toBeVisible();
      await expect(templateButton).toHaveCount(0);
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
        'Evaluación de capital de trabajo',
      );
      await expectKeyboardFocus(page);
      await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
      return;
    }

    const invalidDraft = await page.request.post('/api/financial-agents', {
      data: {
        name: 'No debe publicarse',
        objective: 'Prueba',
        questions: ['¿Prueba?'],
        status: 'published',
      },
    });
    expect(invalidDraft.status()).toBe(400);
    expect(Object.keys((await invalidDraft.json()).errors)).not.toHaveLength(0);

    await expect(page.getByRole('heading', { name: 'Primer agente' })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Objetivo', { exact: true })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue('');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Escribe un nombre')).toBeVisible();
    await expect(page.getByText('Describe el objetivo')).toBeVisible();
    await expect(page.getByText('Escribe una pregunta')).toBeVisible();

    const manualList = await page.request.get('/api/financial-agents');
    expect(manualList.status()).toBe(200);
    expect(await manualList.json()).toEqual({ items: [] });

    const ownerBeforeTemplate = await prisma.user.findUnique({ where: { email } });
    expect(ownerBeforeTemplate).not.toBeNull();
    if (!ownerBeforeTemplate) throw new Error('No se encontró la cuenta sintética');
    expect(
      await prisma.financialAgent.count({ where: { userId: ownerBeforeTemplate.id } }),
    ).toBe(0);

    await templateButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
      'Evaluación financiera inicial',
    );
    await expect(page.getByLabel('Objetivo', { exact: true })).toHaveValue(
      'Recopilar la información necesaria para una evaluación financiera inicial',
    );
    await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue(
      '¿Cuál es el objetivo de la solicitud?',
    );
    await expect(page.getByRole('textbox', { name: 'Pregunta 2' })).toHaveValue(
      '¿Qué monto aproximado se evalúa?',
    );
    await expect(page.getByRole('textbox', { name: 'Pregunta 3' })).toHaveValue(
      '¿En qué plazo se requiere?',
    );
    const desktopTemplateFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(desktopTemplateFits).toBe(true);
    await page
      .getByRole('textbox', { name: 'Pregunta 1' })
      .fill('¿Qué objetivo financiero tiene la solicitud?');
    const listBeforeSave = await page.request.get('/api/financial-agents');
    expect(listBeforeSave.status()).toBe(200);
    expect(await listBeforeSave.json()).toEqual({ items: [] });
    expect(
      await prisma.financialAgent.count({ where: { userId: ownerBeforeTemplate.id } }),
    ).toBe(0);

    await page.route('**/api/financial-agents', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Error de prueba' }),
      });
    });
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
      'Evaluación financiera inicial',
    );
    await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue(
      '¿Qué objetivo financiero tiene la solicitud?',
    );
    expect(
      await prisma.financialAgent.count({ where: { userId: ownerBeforeTemplate.id } }),
    ).toBe(0);
    await page.unroute('**/api/financial-agents');

    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Borrador guardado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Evaluación financiera inicial/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Primer agente' })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Objetivo', { exact: true })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue('');

    const createdDraft = await prisma.financialAgent.findFirst({
      where: { userId: ownerBeforeTemplate.id },
    });
    expect(await prisma.financialAgent.count({ where: { userId: ownerBeforeTemplate.id } })).toBe(1);
    expect(createdDraft).toMatchObject({
      name: 'Evaluación financiera inicial',
      objective: 'Recopilar la información necesaria para una evaluación financiera inicial',
      status: 'draft',
      questions: [
        '¿Qué objetivo financiero tiene la solicitud?',
        '¿Qué monto aproximado se evalúa?',
        '¿En qué plazo se requiere?',
      ],
    });
    if (!createdDraft) throw new Error('No se persistió el borrador creado desde la plantilla');

    await page.reload();
    const draftButton = page.getByRole('button', { name: /Evaluación financiera inicial/ });
    await expect(draftButton).toBeVisible();
    await draftButton.click();
    await expect(page.getByRole('heading', { name: 'Editar borrador' })).toBeVisible();
    await expect(templateButton).toHaveCount(0);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
      'Evaluación financiera inicial',
    );
    await expect(page.getByLabel('Objetivo', { exact: true })).toHaveValue(
      'Recopilar la información necesaria para una evaluación financiera inicial',
    );
    await expect(page.getByRole('textbox', { name: 'Pregunta 1' })).toHaveValue(
      '¿Qué objetivo financiero tiene la solicitud?',
    );
    await page.getByLabel('Nombre', { exact: true }).fill('Evaluación de capital de trabajo');
    await page
      .getByLabel('Objetivo', { exact: true })
      .fill('Preparar una revisión inicial de capital de trabajo.');
    await page
      .getByRole('textbox', { name: 'Pregunta 1' })
      .fill('¿Qué operación necesita financiación?');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Borrador guardado')).toBeVisible();

    const owner = await prisma.user.findUnique({ where: { email } });
    expect(owner).not.toBeNull();
    if (!owner) throw new Error('No se encontró la persona propietaria');
    const persisted = await prisma.financialAgent.findFirst({
      where: { userId: owner.id },
      orderBy: { updatedAt: 'desc' },
    });
    expect(persisted).toMatchObject({
      name: 'Evaluación de capital de trabajo',
      objective: 'Preparar una revisión inicial de capital de trabajo.',
      status: 'draft',
      questions: [
        '¿Qué operación necesita financiación?',
        '¿Qué monto aproximado se evalúa?',
        '¿En qué plazo se requiere?',
      ],
    });
    if (!persisted) throw new Error('No se persistió el borrador');

    const anonymousPatch = await request.patch(`/api/financial-agents/${persisted.id}`, {
      data: { name: 'Cambio anónimo' },
    });
    expect(anonymousPatch.status()).toBe(401);

    secondContext = await browser.newContext({
      baseURL: appBaseURL,
      viewport: { width: 1280, height: 800 },
    });
    const existingSecondUser = await prisma.user.findUnique({ where: { email: anotherEmail } });
    if (!existingSecondUser) {
      const secondSignup = await secondContext.request.post('/api/auth/sign-up/email', {
        headers: { Origin: origin },
        data: { name: anotherName, email: anotherEmail, password, callbackURL: '/dashboard' },
      });
      expect(
        secondSignup.ok(),
        `Alta de aislamiento rechazada: ${secondSignup.status()}`,
      ).toBe(true);
    }
    let secondSignin = await secondContext.request.post('/api/auth/sign-in/email', {
      headers: { Origin: origin },
      data: { email: anotherEmail, password, callbackURL: '/dashboard' },
    });
    let secondSigninError = await authError(secondSignin);
    if (
      secondSigninError?.code === 'EMAIL_NOT_VERIFIED' ||
      secondSigninError?.message === 'Email not verified'
    ) {
      await markVerified(prisma, anotherEmail);
      secondSignin = await secondContext.request.post('/api/auth/sign-in/email', {
        headers: { Origin: origin },
        data: { email: anotherEmail, password, callbackURL: '/dashboard' },
      });
      secondSigninError = await authError(secondSignin);
    }
    expect(
      secondSignin.ok(),
      `Inicio de cuenta de aislamiento rechazado: ${secondSigninError?.code ?? secondSignin.status()}`,
    ).toBe(true);

    const secondPage = await secondContext.newPage();
    await secondPage.goto('/dashboard');
    await expect(secondPage.getByText('Aún no tienes borradores')).toBeVisible();
    const secondList = await secondPage.request.get('/api/financial-agents');
    expect(secondList.status()).toBe(200);
    expect(await secondList.json()).toEqual({ items: [] });

    const crossOwnerPatch = await secondPage.request.patch(
      `/api/financial-agents/${persisted.id}`,
      { data: { name: 'Cambio desde otra cuenta' } },
    );
    expect(crossOwnerPatch.status()).toBe(404);
    const afterCrossOwnerAttempt = await prisma.financialAgent.findUnique({
      where: { id: persisted.id },
    });
    expect(afterCrossOwnerAttempt?.name).toBe('Evaluación de capital de trabajo');

    anonymousContext = await browser.newContext({
      baseURL: appBaseURL,
      viewport: { width: 1280, height: 800 },
    });
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto('/dashboard');
    await expect(anonymousPage).toHaveURL(/\/login$/);
  } finally {
    await secondContext?.close();
    await anonymousContext?.close();
    await context?.close();
    await prisma.$disconnect();
  }
});
