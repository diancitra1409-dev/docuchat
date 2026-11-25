import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`DocuChat API server listening on http://localhost:${PORT}`);
});
