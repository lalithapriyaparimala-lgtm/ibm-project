/**
 * routes/recipes.js
 * Recipe generation endpoint — creates personalised recipes from user preferences.
 */

const express = require('express');
const { retrieve } = require('../src/vectorStore');
const { buildRecipeGenerationPrompt, buildModificationPrompt } = require('../src/promptBuilder');
const { generateText } = require('../src/watsonxClient');

const router = express.Router();

// ─── POST /api/recipes/generate ───────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const {
    ingredients,
    cuisine,
    dietary,
    mealType,
    cookingTime,
    servings,
    skillLevel,
    additionalNotes,
  } = req.body;

  // Build a search query from preferences to pull relevant context
  const searchQuery = [ingredients, cuisine, dietary, mealType, additionalNotes]
    .filter(Boolean)
    .join(' ');

  const topK = parseInt(process.env.TOP_K_RESULTS) || 5;
  const contextChunks = searchQuery ? retrieve(searchQuery, topK) : [];

  const prompt = buildRecipeGenerationPrompt(
    { ingredients, cuisine, dietary, mealType, cookingTime, servings, skillLevel, additionalNotes },
    contextChunks
  );

  try {
    const recipe = await generateText(prompt, { maxTokens: 1500 });

    res.json({
      recipe,
      inspirationSources: contextChunks
        .slice(0, 3)
        .map((c) => c.metadata.filename)
        .filter(Boolean),
    });
  } catch (err) {
    console.error('[recipes/generate] LLM error:', err.message);
    res.status(502).json({ error: 'Failed to generate a recipe. Check your watsonx.ai credentials.' });
  }
});

// ─── POST /api/recipes/modify ─────────────────────────────────────────────────
router.post('/modify', async (req, res) => {
  const { originalRecipe, modification } = req.body;

  if (!originalRecipe || !modification) {
    return res.status(400).json({ error: 'Both originalRecipe and modification are required.' });
  }

  const prompt = buildModificationPrompt(originalRecipe, modification);

  try {
    const modifiedRecipe = await generateText(prompt, { maxTokens: 1500 });
    res.json({ recipe: modifiedRecipe });
  } catch (err) {
    console.error('[recipes/modify] LLM error:', err.message);
    res.status(502).json({ error: 'Failed to modify the recipe.' });
  }
});

module.exports = router;
