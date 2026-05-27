import Fuse from "fuse.js";
import { Readability } from "@mozilla/readability";
import currency from "currency.js";
import * as chrono from "chrono-node";
import nlp from "compromise";
import MiniSearch from "minisearch";
import localforage from "localforage";
import Tesseract from "tesseract.js";
import * as linkify from "linkifyjs";

const root = typeof globalThis !== "undefined" ? globalThis : self;

function compactText(value, max = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizePrice(raw) {
  const text = String(raw || "");
  const symbol = text.includes("₹") || /\b(?:rs|inr)\b/i.test(text) ? "INR" : text.includes("$") ? "USD" : "";
  const match = text.match(/(?:₹|\$|rs\.?|inr)?\s*[\d,.]+(?:\.\d{1,2})?/i);
  if (!match) return { raw: text, value: Infinity, currency: symbol };
  const value = currency(match[0].replace(/[^\d.]/g, "") || 0, { precision: 2 }).value;
  return { raw: match[0].trim(), value, currency: symbol };
}

function fuzzyFind(items, query, keys = ["text", "label", "title", "ariaLabel", "placeholder"]) {
  if (!query || !Array.isArray(items) || !items.length) return null;
  const fuse = new Fuse(items, {
    keys,
    threshold: 0.36,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2
  });
  return fuse.search(query)[0]?.item || null;
}

function parseReadableDocument(doc = root.document) {
  if (!doc?.cloneNode) return null;
  try {
    const article = new Readability(doc.cloneNode(true)).parse();
    if (!article) return null;
    return {
      title: article.title || doc.title || "",
      byline: article.byline || "",
      excerpt: article.excerpt || "",
      textContent: compactText(article.textContent, 12000),
      length: article.length || 0,
      siteName: article.siteName || ""
    };
  } catch (err) {
    return null;
  }
}

function parseCommand(command) {
  const text = String(command || "");
  const lower = text.toLowerCase();
  const doc = nlp(text);
  const nouns = doc.nouns().out("array");
  const topics = [...new Set(nouns.map((item) => item.toLowerCase()).filter(Boolean))].slice(0, 8);
  const dates = chrono.parse(text).map((item) => ({
    text: item.text,
    date: item.start.date().toISOString()
  }));
  const intent =
    /(buy|best|cheap|cheapest|deal|under\s+\d|price|shopping|laptop|phone|hoodie|shoes)/.test(lower) ? "shopping" :
    /(research|compare|report|summarize|summary|find top|best ai|startup ideas)/.test(lower) ? "research" :
    /(job|internship|freelance|remote)/.test(lower) ? "jobs" :
    /(write|rewrite|grammar|shorten|tone|reply|email)/.test(lower) ? "writing" :
    /(form|apply|fill)/.test(lower) ? "form" :
    /(open|go to|visit|launch)/.test(lower) ? "navigation" :
    "general";
  return { intent, topics, dates };
}

function rankProducts(products, query = "") {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return [...(products || [])].map((item) => {
    const priceInfo = normalizePrice(item.price || item.priceText || "");
    const title = String(item.title || "").toLowerCase();
    const rating = Number(item.ratingValue || String(item.rating || "").match(/[\d.]+/)?.[0] || 0);
    const reviews = Number(item.reviewsCount || String(item.reviews || "").replace(/[^\d]/g, "") || 0);
    const relevance = terms.reduce((score, term) => score + (title.includes(term) ? 1 : 0), 0);
    const priceScore = Number.isFinite(priceInfo.value) && priceInfo.value > 0 ? Math.max(0, 100000 / priceInfo.value) : 0;
    const score = relevance * 12 + rating * 18 + Math.log10(reviews + 1) * 8 + priceScore;
    return { ...item, priceValue: priceInfo.value, priceCurrency: priceInfo.currency, localScore: Number(score.toFixed(2)) };
  }).sort((a, b) => b.localScore - a.localScore);
}

function makeSearchIndex(docs = []) {
  const mini = new MiniSearch({
    fields: ["title", "text", "url", "type"],
    storeFields: ["title", "text", "url", "type", "timestamp"],
    searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true }
  });
  mini.addAll(docs.map((doc, index) => ({ id: doc.id || String(index + 1), ...doc })));
  return mini;
}

async function saveMemory(key, value) {
  await localforage.setItem(key, value);
  return value;
}

async function getMemory(key) {
  return await localforage.getItem(key);
}

async function ocrImage(imageLike, options = {}) {
  if (!Tesseract?.recognize) {
    return { success: false, error: "Tesseract.js is not available." };
  }
  try {
    const runtime = root.chrome?.runtime;
    const workerPath = runtime?.getURL ? runtime.getURL("vendor/tesseract/worker.min.js") : undefined;
    const corePath = runtime?.getURL ? runtime.getURL("vendor/tesseract/tesseract-core-lstm.js") : undefined;
    const result = await Tesseract.recognize(imageLike, options.lang || "eng", {
      workerPath,
      corePath,
      logger: options.logger || (() => {})
    });
    return { success: true, data: compactText(result?.data?.text, 12000) };
  } catch (err) {
    return {
      success: false,
      error: `OCR could not run locally. Bundle eng.traineddata in public/vendor/tesseract/lang-data for fully offline OCR. ${err.message || err}`
    };
  }
}

function extractLinkified(text) {
  return linkify.find(String(text || "")).map((item) => ({
    type: item.type,
    value: item.value,
    href: item.href
  }));
}

root.SidekickLibs = {
  Fuse,
  Readability,
  currency,
  chrono,
  nlp,
  MiniSearch,
  localforage,
  Tesseract,
  linkify,
  compactText,
  fuzzyFind,
  normalizePrice,
  parseReadableDocument,
  parseCommand,
  rankProducts,
  makeSearchIndex,
  saveMemory,
  getMemory,
  ocrImage,
  extractLinkified
};
