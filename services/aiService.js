const { query } = require('../db');
const axios = require('axios');

/**
 * Generates MCQs using the active AI provider (primarily Google Gemini).
 */
const generateMCQInitial = async (topic, count = 5) => {
    try {
        // 1. Fetch active AI provider details
        const providerRes = await query('SELECT * FROM ai_providers WHERE is_active = TRUE LIMIT 1');

        if (providerRes.rows.length === 0 || !providerRes.rows[0].api_key) {
            console.warn('No active AI provider or API key found. Falling back to mock.');
            return fallbackMock(topic, count);
        }

        const provider = providerRes.rows[0];
        const { api_key, model_name, base_url } = provider;

        // 2. Prepare Prompt
        const prompt = `Generate exactly ${count} multiple-choice questions (MCQs) about the topic: "${topic}". 
        The output must be a valid JSON array of objects. Each object must have:
        - "question": (string) The MCQ question.
        - "options": (array of 4 strings) Four distinct options.
        - "correct_option": (integer, 0-3) The index of the correct option.
        - "explanation": (string) A detailed explanation of why the answer is correct.
        - "subject": (string) Set as "${topic}".
        - "chapter": (string) A logical chapter name related to the topic.
        
        Return ONLY the JSON array. Do not include markdown formatting like \`\`\`json.`;

        // 3. API Call to Gemini
        // Endpoint: {base_url}/{model}:generateContent?key={api_key}
        const endpoint = `${base_url}/${model_name}:generateContent?key=${api_key}`;

        const response = await axios.post(endpoint, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
                responseMimeType: "application/json"
            }
        });

        // 4. Parse Response
        const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error('AI Provider returned an empty response');
        }

        try {
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(cleanText);
            // Gemini sometimes wraps result in an object or array, normalize to array
            const mcqs = Array.isArray(parsedData) ? parsedData : (parsedData.mcqs || parsedData.questions || []);
            return mcqs.slice(0, count);
        } catch (parseError) {
            console.error('JSON Parse Error from AI:', responseText);
            throw new Error('AI output was not valid JSON: ' + parseError.message);
        }

    } catch (error) {
        console.error('AI Service Error:', error.response?.data || error.message);
        return fallbackMock(topic, count);
    }
};

/**
 * Fallback mock logic if AI fails or is not configured
 */
const fallbackMock = (topic, count) => {
    return Array.from({ length: count }).map((_, i) => ({
        question: `[MOCK] ${topic} practice question ${i + 1}?`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correct_option: 0,
        explanation: `This is a fallback mock explanation for ${topic}. Please check AI API configuration.`,
        subject: topic,
        chapter: 'General'
    }));
};

const fetchAIStructure = async (type, context) => {
    try {
        const providerRes = await query('SELECT * FROM ai_providers WHERE is_active = TRUE LIMIT 1');
        if (providerRes.rows.length === 0 || !providerRes.rows[0].api_key) {
            throw new Error('AI Provider not configured');
        }
        const { api_key, model_name, base_url } = providerRes.rows[0];

        const prompt = `Generate a list of exactly 10 ${type} for the following context: "${context}". 
        Return the result as a valid JSON array of strings. 
        Example: ["Item 1", "Item 2", ...]
        Return ONLY the JSON.`;

        const endpoint = `${base_url}/${model_name}:generateContent?key=${api_key}`;
        const response = await axios.post(endpoint, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error('Empty AI response');

        const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanText);
        return Array.isArray(parsedData) ? parsedData : (parsedData.items || parsedData.list || []);
    } catch (error) {
        console.error('AI Structure Fetch Error:', error.message);
        return fallbackMockStructure(type, context);
    }
};

const fallbackMockStructure = (type, context) => {
    return [
        `Sample ${type} 1 (${context})`,
        `Sample ${type} 2 (${context})`,
        `Sample ${type} 3 (${context})`,
        `Sample ${type} 4 (${context})`,
        `Sample ${type} 5 (${context})`
    ];
};

const generateSchoolBoards = async (stateName) => {
    const prompt = `Return a list of REAL, officially recognized primary/secondary school education boards in the state of "${stateName}", India. 
    Examples: WBCHSE, CBSE, WBBSE, ICSE, MSBSHSE, UPMSP.
    - DO NOT generate placeholders like "Board 1" or "Board A".
    - DO NOT use generic names.
    - Return exactly 10 boards if possible. 
    Return only a JSON array of objects with a "name" key.
    Example: [{"name": "CBSE"}, {"name": "WBBSE"}]
    Return ONLY JSON. STRICTLY NO MARKDOWN.`;
    const boards = await fetchAIStructure('boards', prompt);
    return Array.isArray(boards) ? boards.map(b => typeof b === 'string' ? { name: b } : b) : [];
};

const generateSchoolSubjects = async (boardName, className, streamName) => {
    const prompt = `Return a list of STRICTLY syllabus-accurate subjects for ${className} ${streamName ? `(${streamName})` : ''} under the REAL "${boardName}" education board in India.
    - DO NOT use placeholders like "Subject 1".
    - Use real academic subjects (e.g., Mathematics, Bengali, Physics, History).
    Return only a JSON array of objects with a "name" key.
    Example: [{"name": "Mathematics"}, {"name": "Physics"}]
    Return ONLY JSON. STRICTLY NO MARKDOWN.`;
    const subjects = await fetchAIStructure('subjects', prompt);
    return Array.isArray(subjects) ? subjects.map(s => typeof s === 'string' ? { name: s } : s) : [];
};

const generateSchoolChapters = async (subjectName, boardName, className) => {
    const prompt = `Return a list of OFFICIALLY CORRECT chapters for the subject "${subjectName}" in ${className} of the ${boardName} board in India.
    - DO NOT use placeholders like "Chapter 1".
    - Use real, specific chapter names from the authorized textbook syllabus.
    Return only a JSON array of objects with a "name" key.
    Example: [{"name": "Trigonometry"}, {"name": "Calculus"}]
    Return ONLY JSON. STRICTLY NO MARKDOWN.`;
    const chapters = await fetchAIStructure('chapters', prompt);
    return Array.isArray(chapters) ? chapters.map(c => typeof c === 'string' ? { name: c } : c) : [];
};

module.exports = { generateMCQInitial, fetchAIStructure, generateSchoolBoards, generateSchoolSubjects, generateSchoolChapters };
