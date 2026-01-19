const SUPABASE_URL =
  'https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/debug_logs';
const SUPABASE_KEY = 'sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz';

async function fetchLogById(id) {
  const url = `${SUPABASE_URL}?id=eq.${id}&select=*`;
  console.log(`Fetching log ${id} from: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Supabase error: ${response.status} ${await response.text()}`,
      );
    }

    const data = await response.json();
    if (data.length > 0) {
      console.log('\n--- REPORT CONTENT ---\n');
      console.log(data[0].report);
    } else {
      console.log('Log not found.');
    }
  } catch (error) {
    console.error('❌ Failed to fetch log:', error);
  }
}

const logId = process.argv[2];
if (logId) {
  fetchLogById(logId);
} else {
  console.log('Please provide a log ID');
}
