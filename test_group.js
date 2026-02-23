const axios = require('axios');

const testJoin = async () => {
    try {
        // Testing with a random code to see if we get 401 (Auth error) or 404 (Not found) or 500
        const res = await axios.post('http://localhost:5000/api/group/join', { code: 'ABCDE' });
        console.log('Response:', res.data);
    } catch (error) {
        console.log('Status:', error.response?.status);
        console.log('Data:', error.response?.data);
    }
};

testJoin();
