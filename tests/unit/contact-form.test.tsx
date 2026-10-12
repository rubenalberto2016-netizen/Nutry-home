// @polsia:user-owned
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/custom/contact-form';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

let container: HTMLDivElement;
let root: Root;

async function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  await act(async () => {
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  });
}

async function submitForm() {
  await act(async () => {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(apiFetch).mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('formulario de llamada de ajuste', () => {
  it('muestra validación, error de servicio y confirmación; envía solo datos de encaje no clínicos', async () => {
    await act(async () => root.render(<ContactForm source="la clase magistral a demanda" />));

    await submitForm();
    expect(container.textContent).toContain('Completa las dos preguntas para que podamos valorar el encaje.');
    expect(apiFetch).not.toHaveBeenCalled();

    await setValue(container.querySelector<HTMLInputElement>('#contact-name')!, 'Persona de prueba');
    await setValue(container.querySelector<HTMLInputElement>('#contact-email')!, 'no-es-correo');
    await setValue(container.querySelector<HTMLSelectElement>('#contact-topic')!, 'microbioma');
    await setValue(container.querySelector<HTMLSelectElement>('#contact-investment')!, 'considerar');

    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('Solicitud no válida', { cause: { errors: { email: 'Escribe un correo electrónico válido.' } } }),
    );
    await submitForm();
    expect(container.textContent).toContain('Escribe un correo electrónico válido.');

    await setValue(container.querySelector<HTMLInputElement>('#contact-email')!, 'prueba@example.invalid');
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Servicio no disponible'));
    await submitForm();
    expect(container.textContent).toContain('No pudimos enviar la solicitud. Revisa los datos e inténtalo de nuevo más tarde.');

    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true });
    await submitForm();
    expect(container.textContent).toContain('Solicitud enviada.');
    expect(container.textContent).toContain('La solicitud no reserva una fecha.');
    const submitted = vi.mocked(apiFetch).mock.calls.at(-1)?.[1];
    const body = JSON.parse(String(submitted?.body)) as { message: string };
    expect(body.message).toContain('Tema que desea explorar: Microbioma y salud digestiva.');
    expect(body.message).toContain('Me interesa explorar ese rango.');
    expect(body.message).toContain('la clase magistral a demanda');
    expect(body.message).not.toMatch(/síntomas|diagnóstico|tratamiento/i);
  });
});
