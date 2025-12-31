import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/arc/parse-invoice
 * Extracts structured invoice data from OCR text using AI
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const extractedText = body?.extractedText ?? "";

    console.log(`[parse-invoice] input text length: ${extractedText?.length ?? 0}`);
    console.log(`[parse-invoice] input preview:\n${extractedText?.slice(0, 500)}`);

    if (!extractedText || extractedText.trim().length < 10) {
      console.log(`[parse-invoice] text too short, returning null`);
      return NextResponse.json({
        invoice: null,
        error: "No text to parse",
      });
    }

    // First try regex-based extraction for quick metadata (currency, country, date, total, vendor)
    const regexResult = extractWithRegex(extractedText);
    console.log(`[parse-invoice] regex result:`, JSON.stringify(regexResult));

    // ALWAYS run AI extraction to get structured line items
    // AI is essential for extracting ingredient names that can match recipe ingredients
    console.log(`[parse-invoice] running AI extraction for line items`);

    const client = new OpenAI({ apiKey });
    const textWindow = extractedText.slice(0, 8000); // Limit for tokens

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are an invoice parser for a chef's cost analysis system. Extract structured data from invoice/receipt OCR text.

CRITICAL: Extract line items with STANDARDIZED INGREDIENT NAMES that can be matched to recipe ingredients.
- Normalize names: "Chicken thigh (boneless)" → "chicken thigh"
- Use lowercase, singular forms
- Remove brand names, just keep the ingredient
- Include common cooking ingredients only (not packaging, fees, etc.)

Return a JSON object:
{
  "vendor": "Store or company name",
  "country": "Country name or code (infer from currency if not explicit)",
  "city": "City name if mentioned",
  "currency": "Currency code (USD, EUR, GBP, LKR, INR, etc.)",
  "date": "Date in YYYY-MM-DD format",
  "total": "Total amount as number string",
  "items": [
    {
      "name": "standardized ingredient name (lowercase, singular)",
      "originalName": "original name from invoice",
      "quantity": "numeric quantity",
      "unit": "unit (kg, g, L, ml, pieces, bunch, etc.)",
      "unitPrice": "price per unit",
      "lineTotal": "total for this line"
    }
  ]
}

Examples of name standardization:
- "Chicken thigh (boneless) 8 kg" → name: "chicken thigh", originalName: "Chicken thigh (boneless)"
- "Garlic 0.6 kg" → name: "garlic", originalName: "Garlic"
- "Soy sauce (bulk) 1.2 L" → name: "soy sauce", originalName: "Soy sauce (bulk)"
- "Brown sugar - 0.8 kg" → name: "brown sugar", originalName: "Brown sugar"

Return ONLY valid JSON, no explanations.`,
        },
        {
          role: "user",
          content: `Parse this invoice/receipt:\n\n${textWindow}`,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    console.log(`[parse-invoice] AI reply:\n${reply}`);

    try {
      // Extract JSON from response
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiParsed = JSON.parse(jsonMatch[0]);
        console.log(`[parse-invoice] AI parsed result:`, JSON.stringify(aiParsed));

        // Merge: prefer regex results for metadata (more reliable), AI for items
        const merged = {
          vendor: regexResult.vendor || aiParsed.vendor || null,
          country: regexResult.country || aiParsed.country || null,
          city: regexResult.city || aiParsed.city || null,
          currency: regexResult.currency || aiParsed.currency || null,
          date: regexResult.date || aiParsed.date || null,
          total: regexResult.total || aiParsed.total || null,
          items: Array.isArray(aiParsed.items) ? aiParsed.items : [],
          confidence: "high",
          source: "ai",
        };

        console.log(`[parse-invoice] merged result:`, JSON.stringify(merged));
        return NextResponse.json({ invoice: merged });
      }
    } catch (parseErr) {
      console.log(`[parse-invoice] JSON parse failed:`, parseErr);
    }

    // AI failed, return regex result with empty items
    if (regexResult.currency || regexResult.country || regexResult.date) {
      console.log(`[parse-invoice] AI failed, using regex fallback`);
      return NextResponse.json({
        invoice: {
          ...regexResult,
          items: [],
          confidence: "low",
          source: "ocr",
        },
      });
    }

    return NextResponse.json({
      invoice: null,
      error: "Failed to parse invoice",
    });
  } catch (err: any) {
    console.error("[parse-invoice] Error:", err);
    return NextResponse.json(
      { invoice: null, error: err?.message || "Parse failed" },
      { status: 500 }
    );
  }
}

/**
 * Quick regex-based extraction for common invoice patterns
 */
function extractWithRegex(text: string): {
  vendor?: string;
  country?: string;
  city?: string;
  currency?: string;
  date?: string;
  total?: string;
} {
  const result: {
    vendor?: string;
    country?: string;
    city?: string;
    currency?: string;
    date?: string;
    total?: string;
  } = {};

  // Currency detection with country inference
  // Check specific currency codes first (before generic symbols)
  if (/\bLKR\b/.test(text)) { result.currency = "LKR"; result.country = "Sri Lanka"; }
  else if (/\bINR\b|₹/.test(text)) { result.currency = "INR"; result.country = "India"; }
  else if (/\bMYR\b|\bRM\s?\d/.test(text)) { result.currency = "MYR"; result.country = "Malaysia"; }
  else if (/\bPHP\b|₱/.test(text)) { result.currency = "PHP"; result.country = "Philippines"; }
  else if (/\bIDR\b|\bRp\s?\d/.test(text)) { result.currency = "IDR"; result.country = "Indonesia"; }
  else if (/\bVND\b|₫/.test(text)) { result.currency = "VND"; result.country = "Vietnam"; }
  else if (/\bNZD\b/.test(text)) { result.currency = "NZD"; result.country = "New Zealand"; }
  else if (/\bZAR\b/.test(text)) { result.currency = "ZAR"; result.country = "South Africa"; }
  else if (/\bAED\b/.test(text)) { result.currency = "AED"; result.country = "UAE"; }
  else if (/\bSAR\b/.test(text)) { result.currency = "SAR"; result.country = "Saudi Arabia"; }
  else if (/\bCNY\b|\bRMB\b/.test(text)) { result.currency = "CNY"; result.country = "China"; }
  else if (/\bJPY\b/.test(text)) { result.currency = "JPY"; result.country = "Japan"; }
  else if (/\bKRW\b|₩/.test(text)) { result.currency = "KRW"; result.country = "South Korea"; }
  else if (/\bTHB\b|฿/.test(text)) { result.currency = "THB"; result.country = "Thailand"; }
  else if (/\bSGD\b/.test(text)) { result.currency = "SGD"; result.country = "Singapore"; }
  else if (/\bHKD\b/.test(text)) { result.currency = "HKD"; result.country = "Hong Kong"; }
  else if (/\bAUD\b/.test(text)) { result.currency = "AUD"; result.country = "Australia"; }
  else if (/\bCAD\b/.test(text)) { result.currency = "CAD"; result.country = "Canada"; }
  else if (/\bCHF\b/.test(text)) { result.currency = "CHF"; result.country = "Switzerland"; }
  else if (/\bGBP\b|£/.test(text)) { result.currency = "GBP"; result.country = "UK"; }
  else if (/\bEUR\b|€/.test(text)) { result.currency = "EUR"; }
  else if (/\bUSD\b|\$/.test(text)) { result.currency = "USD"; }
  else if (/¥/.test(text)) { result.currency = "JPY"; result.country = "Japan"; }

  // Vendor/Supplier extraction
  const vendorMatch = text.match(/(?:Supplier|Vendor|From|Bill from|Company|Store|Shop)[:\s]+([^\n]+)/i);
  if (vendorMatch) {
    result.vendor = vendorMatch[1].trim().replace(/\s+/g, " ");
  }

  // Date patterns (various formats)
  const datePatterns = [
    /(\d{4}[-/]\d{2}[-/]\d{2})/, // 2024-12-30
    /(\d{2}[-/]\d{2}[-/]\d{4})/, // 30-12-2024
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i, // 30 December 2024
    /(?:Date|Invoice Date|Order Date)[:\s]*([^\n]{6,20})/i, // Date: ...
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.date = match[1].trim();
      break;
    }
  }

  // Total amount (handle various currency formats)
  const totalPatterns = [
    /(?:Total Paid|Grand Total|Total|Amount Due|Balance Due)[:\s]*(?:LKR|INR|MYR|PHP|IDR|VND|THB|SGD|HKD|AUD|CAD|CHF|GBP|EUR|USD|[$€£¥₹₱฿₩])?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:LKR|INR|MYR|PHP|IDR|VND|THB|SGD|HKD|AUD|CAD|CHF|GBP|EUR|USD)\s*([\d,]+(?:\.\d{2})?)/i,
    /[$€£¥₹₱฿₩]\s*([\d,]+\.\d{2})/,
  ];
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.total = match[1].replace(/,/g, "");
      break;
    }
  }

  // Country detection (common patterns)
  const countryPatterns: [RegExp, string][] = [
    [/\bUSA\b|\bUnited States\b/i, "USA"],
    [/\bUK\b|\bUnited Kingdom\b|\bEngland\b/i, "UK"],
    [/\bCanada\b/i, "Canada"],
    [/\bAustralia\b/i, "Australia"],
    [/\bGermany\b|\bDeutschland\b/i, "Germany"],
    [/\bFrance\b/i, "France"],
    [/\bJapan\b|日本/i, "Japan"],
    [/\bSingapore\b/i, "Singapore"],
    [/\bHong Kong\b|香港/i, "Hong Kong"],
    [/\bSwitzerland\b|\bSchweiz\b/i, "Switzerland"],
    [/\bNetherlands\b|\bHolland\b/i, "Netherlands"],
    [/\bSpain\b|\bEspaña\b/i, "Spain"],
    [/\bItaly\b|\bItalia\b/i, "Italy"],
    [/\bKorea\b|한국/i, "South Korea"],
    [/\bThailand\b|ประเทศไทย/i, "Thailand"],
  ];
  for (const [pattern, country] of countryPatterns) {
    if (pattern.test(text)) {
      result.country = country;
      break;
    }
  }

  // City detection (look for common city names or patterns)
  const cityPatterns: [RegExp, string][] = [
    // Sri Lanka
    [/\bColombo\b/i, "Colombo"],
    [/\bKandy\b/i, "Kandy"],
    [/\bGalle\b/i, "Galle"],
    [/\bWeligama\b/i, "Weligama"],
    [/\bNegombo\b/i, "Negombo"],
    // Major world cities
    [/\bNew York\b|\bNYC\b/i, "New York"],
    [/\bLos Angeles\b|\bLA\b/i, "Los Angeles"],
    [/\bLondon\b/i, "London"],
    [/\bParis\b/i, "Paris"],
    [/\bTokyo\b|東京/i, "Tokyo"],
    [/\bBerlin\b/i, "Berlin"],
    [/\bSydney\b/i, "Sydney"],
    [/\bMelbourne\b/i, "Melbourne"],
    [/\bSan Francisco\b|\bSF\b/i, "San Francisco"],
    [/\bSeattle\b/i, "Seattle"],
    [/\bChicago\b/i, "Chicago"],
    [/\bToronto\b/i, "Toronto"],
    [/\bVancouver\b/i, "Vancouver"],
    [/\bAmsterdam\b/i, "Amsterdam"],
    [/\bDubai\b/i, "Dubai"],
    [/\bHong Kong\b|香港/i, "Hong Kong"],
    [/\bSingapore\b/i, "Singapore"],
    [/\bSeoul\b|서울/i, "Seoul"],
    [/\bBangkok\b|กรุงเทพ/i, "Bangkok"],
    [/\bMumbai\b|\bBombay\b/i, "Mumbai"],
    [/\bDelhi\b/i, "Delhi"],
    [/\bBengaluru\b|\bBangalore\b/i, "Bengaluru"],
    [/\bKuala Lumpur\b|\bKL\b/i, "Kuala Lumpur"],
    [/\bJakarta\b/i, "Jakarta"],
    [/\bManila\b/i, "Manila"],
    [/\bHo Chi Minh\b|\bSaigon\b/i, "Ho Chi Minh City"],
    [/\bHanoi\b/i, "Hanoi"],
  ];
  for (const [pattern, city] of cityPatterns) {
    if (pattern.test(text)) {
      result.city = city;
      break;
    }
  }

  return result;
}

