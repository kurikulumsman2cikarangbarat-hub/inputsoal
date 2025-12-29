// netlify/functions/nocodb-proxy.js
// Proxy untuk semua operasi database

exports.handler = async function(event, context) {
  console.log('=== NOCODB PROXY CALLED ===');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed. Use POST.'
      })
    };
  }

  try {
    // Parse request
    const requestBody = JSON.parse(event.body || '{}');
    const { action, data, table, query } = requestBody;

    console.log('Proxy action:', action);

    // Load config from environment
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

    // Validate config
    if (!apiConfig.baseUrl || !apiConfig.apiToken) {
      throw new Error('NocoDB configuration missing in environment variables');
    }

    // ==================== ACTIONS ====================

    // 1. Get guru list
    if (action === 'get_guru_list') {
      const url = `${apiConfig.baseUrl}${apiConfig.tables.data}?fields=Id,nama_guru,mapel&sort=nama_guru&limit=100`;
      
      console.log('Fetching guru list from:', url);
      
      const response = await fetch(url, {
        headers: {
          'xc-token': apiConfig.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Database error: ${response.status}`);
      }

      const result = await response.json();
      
      const guruList = result.list 
        ? result.list
            .filter(item => item.nama_guru && item.nama_guru.trim() !== '')
            .map(item => ({
              id: item.Id || item.id,
              nama_guru: item.nama_guru,
              mapel: item.mapel || ''
            }))
        : [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          guruList: guruList,
          count: guruList.length
        })
      };
    }

    // 2. Login verification
    if (action === 'login') {
      const { nama_guru, password } = data || {};
      
      if (!nama_guru || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Nama guru dan password diperlukan'
          })
        };
      }

      const encodedName = encodeURIComponent(nama_guru);
      const url = `${apiConfig.baseUrl}${apiConfig.tables.data}?where=(nama_guru,eq,${encodedName})`;
      
      console.log('Login query:', url);
      
      const response = await fetch(url, {
        headers: {
          'xc-token': apiConfig.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Database error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.list || result.list.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Nama guru tidak ditemukan'
          })
        };
      }

      const user = result.list[0];
      
      if (!user.pwd || user.pwd !== password) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Password salah'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Login berhasil',
          user: {
            nama_guru: user.nama_guru,
            mapel: user.mapel || '',
            role: user.role || 'guru',
            id: user.Id || user.id
          },
          config: {
            baseUrl: apiConfig.baseUrl,
            projectId: apiConfig.projectId,
            tables: apiConfig.tables
          }
        })
      };
    }

    // 3. Save data to any table
    if (action === 'save_data') {
      if (!table || !data) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Table dan data diperlukan'
          })
        };
      }

      const url = `${apiConfig.baseUrl}${table}`;
      
      console.log('Saving to:', url, 'Data:', data);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xc-token': apiConfig.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.text();
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.status} - ${result}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Data berhasil disimpan',
          data: JSON.parse(result)
        })
      };
    }

    // 4. Query data
    if (action === 'query') {
      if (!table) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Table diperlukan'
          })
        };
      }

      let url = `${apiConfig.baseUrl}${table}`;
      if (query) {
        url += `?${query}`;
      }
      
      console.log('Querying:', url);
      
      const response = await fetch(url, {
        headers: {
          'xc-token': apiConfig.apiToken,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.text();
      
      if (!response.ok) {
        throw new Error(`Query failed: ${response.status} - ${result}`);
      }

      return {
        statusCode: 200,
        headers,
        body: result
      };
    }

    // Unknown action
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Action tidak dikenali',
        availableActions: ['get_guru_list', 'login', 'save_data', 'query']
      })
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Server error',
        error: error.message
      })
    };
  }
};