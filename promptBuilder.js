/**
 * promptBuilder.js
 * Constructs structured prompts for IBM Granite for two tasks:
 *   1. RAG-based Q&A over uploaded recipe documents
 *   2. Personalised recipe generation from user preferences
 */

// ─── System persona ───────────────────────────────────────────────────────────
const SYSTEM_PERSONA = `You are Chef Granite, a professional culinary AI assistant powered by IBM Granite.
You provide accurate, helpful, and delicious recipe advice.
When answering questions, always base your response on the provided context.
When generating recipes, produce clearly structured output with ingredients and step-by-step instructions.`;

// ─── RAG Q&A Prompt ───────────────────────────────────────────────────────────

/**
 * Builds a RAG Q&A prompt using retrieved context chunks.
 *
 * @param {string}   question
 * @param {{ text: string, metadata: object, score: number }[]} contextChunks
 * @returns {string}
 */
function buildRAGPrompt(question, contextChunks) {
  const contextBlock =
    contextChunks.length > 0
      ? contextChunks
          .map((c, i) => `[Source ${i + 1}: ${c.metadata.filename || 'document'}]\n${c.text}`)
          .join('\n\n---\n\n')
      : 'No relevant recipe documents have been uploaded yet.';

  return `${SYSTEM_PERSONA}

<context>
${contextBlock}
</context>

<instructions>
Answer the following question using ONLY the information provided in the context above.
If the answer is not in the context, say so clearly and offer general culinary advice.
Be specific, practical, and concise.
</instructions>

<question>
${question}
</question>

<answer>`;
}

// ─── Recipe Generation Prompt ─────────────────────────────────────────────────

/**
 * Builds a recipe generation prompt from user preferences.
 *
 * @param {object} prefs
 * @param {string}   prefs.ingredients      - comma-separated available ingredients
 * @param {string}   prefs.cuisine          - preferred cuisine type
 * @param {string}   prefs.dietary          - dietary restrictions (vegan, gluten-free, etc.)
 * @param {string}   prefs.mealType         - breakfast / lunch / dinner / snack / dessert
 * @param {string}   prefs.cookingTime      - max cooking time in minutes
 * @param {string}   prefs.servings         - number of servings
 * @param {string}   prefs.skillLevel       - beginner / intermediate / advanced
 * @param {string}   prefs.additionalNotes  - any extra preferences
 * @param {{ text: string }[]} contextChunks - relevant recipe chunks from RAG
 * @returns {string}
 */
function buildRecipeGenerationPrompt(prefs, contextChunks = []) {
  const contextSection =
    contextChunks.length > 0
      ? `\n<reference_recipes>\nHere are some relevant recipes from the uploaded documents for inspiration:\n\n${contextChunks
          .map((c) => c.text)
          .join('\n\n---\n\n')}\n</reference_recipes>\n`
      : '';

  const constraints = [
    prefs.dietary && `Dietary restrictions: ${prefs.dietary}`,
    prefs.cookingTime && `Maximum cooking time: ${prefs.cookingTime} minutes`,
    prefs.servings && `Servings: ${prefs.servings}`,
    prefs.skillLevel && `Skill level: ${prefs.skillLevel}`,
    prefs.cuisine && `Cuisine style: ${prefs.cuisine}`,
    prefs.mealType && `Meal type: ${prefs.mealType}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `${SYSTEM_PERSONA}
${contextSection}
<task>
Generate a complete, original recipe based on the following user preferences.
</task>

<preferences>
Available ingredients: ${prefs.ingredients || 'anything suitable'}
${constraints}
${prefs.additionalNotes ? `Additional notes: ${prefs.additionalNotes}` : ''}
</preferences>

<format>
Respond with a recipe in this exact structure:

## [Recipe Name]

**Description:** A brief, appetising description (2-3 sentences).

**Prep Time:** X minutes
**Cook Time:** X minutes
**Total Time:** X minutes
**Servings:** X
**Difficulty:** Beginner / Intermediate / Advanced
**Cuisine:** [type]

### Ingredients
- [quantity] [ingredient]
(list all ingredients)

### Instructions
1. [Step description]
(number each step clearly)

### Chef's Tips
- [tip 1]
- [tip 2]

### Nutritional Highlights (approximate per serving)
- Calories: ~X kcal
- Protein: ~Xg
- Carbs: ~Xg
- Fat: ~Xg
</format>

<recipe>`;
}

// ─── Follow-up / Modification Prompt ─────────────────────────────────────────

/**
 * Builds a prompt to modify or adapt an existing generated recipe.
 *
 * @param {string} originalRecipe
 * @param {string} modificationRequest
 * @returns {string}
 */
function buildModificationPrompt(originalRecipe, modificationRequest) {
  return `${SYSTEM_PERSONA}

<original_recipe>
${originalRecipe}
</original_recipe>

<modification_request>
${modificationRequest}
</modification_request>

<instructions>
Adapt the recipe above according to the modification request.
Keep the same structured format.
Explain briefly what was changed and why.
</instructions>

<modified_recipe>`;
}

module.exports = { buildRAGPrompt, buildRecipeGenerationPrompt, buildModificationPrompt };
