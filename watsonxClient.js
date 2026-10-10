/**
 * watsonxClient.js
 * Handles authentication and text generation calls to IBM watsonx.ai
 * using the IBM Granite LLM.
 */

const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Fetches a fresh IAM access token using the configured API key.
 */
async function getIAMToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const resp = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: process.env.WATSONX_API_KEY,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = resp.data.access_token;
  tokenExpiry = now + resp.data.expires_in * 1000;
  return cachedToken;
}

/**
 * Sends a prompt to IBM Granite via watsonx.ai and returns the generated text.
 *
 * @param {string} prompt  - The full prompt string
 * @param {object} options - Override default generation parameters
 * @returns {Promise<string>}
 */
async function generateText(prompt, options = {}) {
  const token = await getIAMToken();

  const payload = {
    model_id: process.env.GRANITE_MODEL_ID || 'ibm/granite-3-8b-instruct',
    input: prompt,
    parameters: {
      decoding_method: 'greedy',
      max_new_tokens: options.maxTokens ?? parseInt(process.env.MAX_TOKENS) || 1024,
      temperature: options.temperature ?? parseFloat(process.env.TEMPERATURE) || 0.7,
      repetition_penalty: 1.1,
      stop_sequences: options.stopSequences ?? [],
    },
    project_id: process.env.WATSONX_PROJECT_ID,
  };

  const url = `${process.env.WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`;

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  const result = resp.data?.results?.[0]?.generated_text ?? '';
  return result.trim();
}

module.exports = { generateText };
