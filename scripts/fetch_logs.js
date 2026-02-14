
const SUPABASE_URL = "https://exymyvbkjsttqsnifedq.supabase.co/rest/v1/debug_logs";
const SUPABASE_KEY = "sb_publishable_tyLE5ronU6B5LAGta5GBjA_ZSqpzHyz";

async function fetchLogs() {
  const url = `${SUPABASE_URL}?select=*&order=created_at.desc&limit=1`;
  console.log(`Fetching from: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    console.log("Latest Log Entry:");
    console.log(JSON.stringify(data, null, 2));
    
    if (data.length > 0 && data[0].report) {
         console.log("\n--- REPORT CONTENT ---\n");
         console.log(data[0].report);
    }

  } catch (error) {
    console.error("❌ Failed to fetch logs:", error);
  }
}

fetchLogs();
