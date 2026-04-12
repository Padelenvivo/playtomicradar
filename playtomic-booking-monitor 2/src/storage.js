const fs = require("fs/promises");
const path = require("path");

async function loadProcessedIds(filePath) {
  try {
    const rawContent = await fs.readFile(filePath, "utf8");
    const parsedContent = JSON.parse(rawContent);

    if (Array.isArray(parsedContent)) {
      return new Set(parsedContent.map(String));
    }

    throw new Error("El archivo de reservas procesadas debe contener un array JSON.");
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Set();
    }

    throw error;
  }
}

async function saveProcessedIds(filePath, processedIds) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const orderedIds = Array.from(processedIds).sort();

  await fs.writeFile(filePath, `${JSON.stringify(orderedIds, null, 2)}\n`, "utf8");
}

module.exports = {
  loadProcessedIds,
  saveProcessedIds
};
