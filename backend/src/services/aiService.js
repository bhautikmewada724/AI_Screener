import axios from 'axios';

const client = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  timeout: 10_000
});

const ensureConfigured = () => {
  if (!process.env.AI_SERVICE_URL) {
    throw new Error('AI_SERVICE_URL is not configured in backend/.env');
  }
};

export const parseResume = async (payload) => {
  ensureConfigured();
  const { data } = await client.post('/ai/parse-resume', payload);
  return data;
};

export const parseJobDescription = async (payload) => {
  ensureConfigured();
  const { data } = await client.post('/ai/parse-jd', payload);
  return data;
};

export const matchResumeToJob = async (payload) => {
  ensureConfigured();
  const { data } = await client.post('/ai/match', payload);
  return data;
};

export const getRecommendations = async (payload) => {
  ensureConfigured();
  const { data } = await client.post('/ai/recommend', payload);
  return data;
};

export const pingAIService = async () => {
  ensureConfigured();
  const { data } = await client.get('/health');
  return data;
};

