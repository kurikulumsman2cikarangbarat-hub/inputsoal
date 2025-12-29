// netlify/functions/nocodb-config.js
// Fungsi untuk mengambil config dari environment variables

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Ambil dari environment variables Netlify
    const apiConfig = {
      baseUrl: process.env.NOCODB_URL,
      apiToken: process.env.NOCODB_TOKEN,
      projectId: process.env.NOCODB_PROJECT_ID,
      tables: {
        bank_soal: process.env.NOCODB_TABLE_BANK_SOAL || 'bank_soal',
        ujian: process.env.NOCODB_TABLE_UJIAN || 'ujian',
        data: process.env.NOCODB_TABLE_DATA || 'data'
      }
    };

    // Debug log (hanya di server)
    console.log('NocoDB Config loaded:', {
      hasUrl: !!apiConfig.baseUrl,
      hasToken: !!apiConfig.apiToken,
      hasProjectId: !!apiConfig.projectId
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'NocoDB configuration',
        config: {
          baseUrl: apiConfig.baseUrl,
          projectId: apiConfig.projectId,
          tables: apiConfig.tables
          // Token tidak dikirim ke client untuk keamanan
        }
      })
    };

  } catch (error) {
    console.error('Error in nocodb-config:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};