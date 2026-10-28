import { GoogleGenAI } from '@google/genai';
import { createApp } from './src/app.js';
import { createPlanner } from './src/planner.js';

const PORT = Number(process.env.PORT) || 8080;

function createAiClient() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'favorable-tree-512622-b6';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  try {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  } catch (error) {
    console.warn('Failed to initialize GoogleGenAI client, running with fallback planner:', error.message);
    return null;
  }
}

const app = createApp({ plan: createPlanner(createAiClient()) });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aadaya Event Organization server listening on port ${PORT}`);
});
