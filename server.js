import { GoogleGenAI } from '@google/genai';
import { createApp } from './src/app.js';
import { createPlanner } from './src/planner.js';

const PORT = Number(process.env.PORT) || 8080;

function createAiClient() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    console.warn('GOOGLE_CLOUD_PROJECT not set: running with the rule-based fallback planner only.');
    return null;
  }
  return new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  });
}

const app = createApp({ plan: createPlanner(createAiClient()) });
app.listen(PORT, () => console.log(`Utsav AI listening on port ${PORT}`));
