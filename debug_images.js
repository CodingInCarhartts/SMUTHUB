const QUERY = `
query get_chapterNode($id: ID!) {
    get_chapterNode(id: $id) {
        id
        data {
            dname
            imageFile { urlList }
            count_images
        }
    }
}
`;

async function fetchChapter(id) {
  try {
    const response = await fetch('https://bato.si/ap2/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://bato.si/',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { id: id },
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error: ${response.status}`);
      return [];
    }

    const json = await response.json();
    return json.data?.get_chapterNode?.data?.imageFile?.urlList || [];
  } catch (e) {
    console.error('Fetch failed:', e);
    return [];
  }
}

async function run() {
  console.log('Fetching Working Chapter (3405881)...');
  const working = await fetchChapter('3405881');
  console.log('first 3 working:', working.slice(0, 3));

  console.log('\nFetching Broken Chapter (3998756)...');
  const broken = await fetchChapter('3998756');
  console.log('first 3 broken:', broken.slice(0, 3));
}

run();
