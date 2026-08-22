/**
 * Test Chat API - UltraWebThinking
 * Test script për sistemin tonë vetë-krijues
 */

async function testChatAPI() {
  try {
    console.log('🚀 Testing UltraWebThinking Chat API...');
    
    const response = await fetch('http://localhost:23000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Përshëndetje UltraWebThinking!'
      })
    });

    console.log(`📊 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response received:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error response:');
      const errorText = await response.text();
      console.log(errorText);
    }

  } catch (error) {
    console.error('🔥 Test Error:', error.message);
    
    // Test me GET endpoint
    try {
      console.log('\n🔄 Testing GET endpoint...');
      const getResponse = await fetch('http://localhost:23000/api/chat');
      console.log(`📊 GET Status: ${getResponse.status}`);
      
      if (getResponse.ok) {
        const getData = await getResponse.json();
        console.log('✅ GET Response:');
        console.log(JSON.stringify(getData, null, 2));
      }
    } catch (getError) {
      console.error('❌ GET Test failed:', getError.message);
    }
  }
}

// Run test
testChatAPI();
