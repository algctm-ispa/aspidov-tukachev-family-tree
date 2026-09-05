// Photo convention: drop a file named "<person id>.jpg" into assets/photos/
// and it's picked up everywhere automatically — no manifest to maintain.
// Nothing there yet just falls back to a placeholder.

function personPhotoUrl(personId) {
  return `assets/photos/${personId}.jpg`;
}

function checkImageExists(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function computePhotoAvailability(familyData) {
  const ids = [...familyData.people.keys()];
  const results = await Promise.all(ids.map(id => checkImageExists(personPhotoUrl(id))));
  const available = new Set();
  ids.forEach((id, i) => { if (results[i]) available.add(id); });
  return available;
}
