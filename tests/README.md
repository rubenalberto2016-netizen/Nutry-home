# Pruebas del espacio financiero

## Cobertura

- `npm run test` valida el contrato Zod: campos requeridos, límites, preguntas y rechazo de `userId`/`status` enviados por el cliente.
- `npm run test:e2e` recorre el alta pública, el inicio de sesión, el guardado del borrador, su recuperación tras recargar y la edición. También comprueba los 401 anónimos, el 404 entre propietarios, el aislamiento de la lista, el foco visible al tabular y el desbordamiento horizontal.
- La prueba E2E confirma que la creación manual empieza vacía, que hay una sola plantilla opcional, que sus campos se pueden editar y que elegirla no persiste datos. También fuerza un 500 para comprobar el aviso y la retención del formulario; después guarda mediante la API real y verifica en PostgreSQL los valores y el estado draft. Tras recargar, edita el borrador y comprueba que la plantilla no aparece en ese modo.
- Conserva además los 401 anónimos, el 404 entre propietarios, el aislamiento de la lista, el guardado del propietario, el foco visible al tabular y la ausencia de controles de ejecución, publicación y pagos.
- Playwright ejecuta el mismo recorrido en Chromium a 1280 px y 390 px.

El E2E requiere la base PostgreSQL desechable que inyecta el runner, `BASE_URL` y los valores sintéticos de `.env.test`. En cada ejecución completa genera dos cuentas sintéticas y las registra mediante la interfaz pública de alta o su endpoint Better Auth. Si el inicio de sesión responde que el correo no está verificado, confirma únicamente esa cuenta sintética por Prisma después de recibir el error y repite el acceso. La vista móvil reutiliza la sesión creada por el recorrido de escritorio; durante un reintento también se reutilizan las cookies de la sesión propia. Nunca consulta ni modifica identidades de clientes.

El módulo de autenticación envía el enlace mediante el proxy de correo. Para la prueba, `.agents/email-proxy-mock.cjs` simula su contrato verificado (`POST /api/proxy/email/send` y respuesta con `email_id`); no se usa una credencial real ni se afirma haber entregado un correo.

Con el servidor de desarrollo ya disponible en `BASE_URL`:

```bash
npm run test
npm run test:e2e
```
