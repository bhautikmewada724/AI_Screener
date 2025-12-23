import axios from 'axios';

let client;

const ensureConfigured = () => {
  if (!process.env.AI_SERVICE_URL) {
    throw new Error('AI_SERVICE_URL is not configured in backend/.env');
  }
};

const getClient = () => {
  ensureConfigured();

  if (!client) {
    client = axios.create({
      baseURL: process.env.AI_SERVICE_URL,
      timeout: 10_000
    });
  }

  return client;
};

export const parseResume = async (payload) => {
  const { data } = await getClient().post('/ai/parse-resume', payload);
  return data;
};

export const parseJobDescription = async (payload) => {
  const { data } = await getClient().post('/ai/parse-jd', payload);
  return data;
};

export const matchResumeToJob = async (payload, options = {}) => {
  const { data } = await getClient().post('/ai/match', payload, options);
  return data;
};

export const getRecommendations = async (payload) => {
  const { data } = await getClient().post('/ai/recommend', payload);
  return data;
};

export const pingAIService = async () => {
  const { data } = await getClient().get('/health');
  return data;
};

