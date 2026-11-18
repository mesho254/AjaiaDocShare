import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Ajaia Docs Backend running at http://localhost:${PORT}`);
  console.log(`Swagger UI API Docs available at http://localhost:${PORT}/api/docs`);
});
