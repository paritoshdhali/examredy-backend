const { fetchAIStructure } = require('./services/aiService');

async function testFetch() {
    try {
        console.log("Fetching Universities for West Bengal...");
        const universities = await fetchAIStructure('Universities', `State of West Bengal, India.Strictly provide original names only.`);
        console.log(universities);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

testFetch();
