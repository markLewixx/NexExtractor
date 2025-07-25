import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const numberList = new Set();
const unproperurl =
  "https://www.google.com/maps/place/CRAVE+KENYA+-+KILIMANI/@-1.3959153,36.7001474,12z/data=!4m10!1m2!2m1!1srestaurants+in+kilimani!3m6!1s0x182f1167d2a363f7:0x46d5548b336ee96d!8m2!3d-1.2935272!4d36.787241!15sChdyZXN0YXVyYW50cyBpbiBraWxpbWFuaVoZIhdyZXN0YXVyYW50cyBpbiBraWxpbWFuaZIBCnJlc3RhdXJhbnSqAVEQASoPIgtyZXN0YXVyYW50cygAMh8QASIb4-51wFDaNfRIPlJB2N7xBmHurZ83zCO7RTSgMhsQAiIXcmVzdGF1cmFudHMgaW4ga2lsaW1hbmngAQA!16s%2Fg%2F11vk4jzg9s?entry=ttu&g_ep=EgoyMDI1MDcxMy4wIKXMDSoASAFQAw%3D%3D";
const url = unproperurl + "?hl=en&gl=us";

const businessSelector = (n) =>
  `div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd > div:nth-child(${n}) > div > a`;

const businessName = () => " div.lMbq3e > div:nth-child(1) > h1";

const venueSelector = "div.Io6YTe.fontBodyMedium.kR99db.fdkmkc";

const sideScrollContainer =
  "#QA0Szd > div > div > div.w6VYqd > div.bJzME.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde";
const mainScroll =
  "#QA0Szd > div > div > div.w6VYqd > div:nth-child(2) > div > div.e07Vkf.kA9KIf > div > div > div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd > div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd.QjC7t";

//// The Get functions
async function getPhoneNumber(page) {
  return await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("div.Io6YTe"));

    const phoneRegex = new RegExp(
      String.raw`^(\+?\d{1,4}[\s\-\.]?)?(\(?\d{1,4}\)?[\s\-\.]?)?(\d{2,5}[\s\-\.]?){2,4}$`
    );

    const phoneDiv = elements.find((el) => {
      const text = el.innerText.trim();
      return phoneRegex.test(text);
    });

    return phoneDiv ? phoneDiv.innerText.trim() : null;
  });
}

async function getBussinesName(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element ? element.innerText : null;
  }, selector);
}

async function wait(time) {
  await new Promise((r) => setTimeout(r, time));
}
const seenBusinesses = new Set();

function isDuplicateBusiness(business) {
  if (!business) return true; // Ignore empty/null names

  if (seenBusinesses.has(business)) {
    return true;
  }

  seenBusinesses.add(business);
  return false;
}

async function autoScrollDown(page, selector, pixels = 100, interval = 1000) {
  await page.evaluate(
    (selector, pixels, interval) => {
      const target = selector ? document.querySelector(selector) : window;

      if (!target) return;

      // Prevent duplicate intervals by checking a flag
      if (target._autoScrollInterval) return;

      const scrollFn = () => {
        if (selector) {
          target.scrollBy({ top: pixels });
        } else {
          window.scrollBy({ top: pixels });
        }
      };

      scrollFn(); // initial scroll
      target._autoScrollInterval = setInterval(scrollFn, interval);
    },
    selector,
    pixels,
    interval
  );
}
async function getWebsiteURL(page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"));

    const websiteLink = links.find(
      (link) =>
        link.href.startsWith("http") &&
        !link.href.includes("google") && // exclude internal Google links
        !link.href.includes("/maps")
    );

    return websiteLink ? websiteLink.href : null;
  });
}

async function getCartegory(page) {
  await page.evaluate(() => {
    const el = document.querySelector("button.DkEaL");
    return el ? el.innerText.trim() : null;
  });
}

async function getRating(page) {
  await page.evaluate(() => {
    // Find the rating span closest to the currently opened business details panel
    const detailsPanel = document.querySelector("div.TIHn2");
    if (!detailsPanel) return null;
    const ratingSpan = Array.from(detailsPanel.querySelectorAll("span")).find(
      (span) => /^[0-9]\.[0-9]$/.test(span.innerText.trim())
    );
    return ratingSpan ? parseFloat(ratingSpan.innerText.trim()) : null;
  });
}
async function getRatingCount(page) {
  await page.evaluate(() => {
    const detailsPanel = document.querySelector("div.TIHn2");
    if (!detailsPanel) return 0;

    const reviewSpan = Array.from(detailsPanel.querySelectorAll("span")).find(
      (span) => span.getAttribute("aria-label")?.match(/\d+\s+reviews/)
    );

    if (reviewSpan) {
      const match = reviewSpan.getAttribute("aria-label").match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }
    return 0;
  });
}

async function getBusinessDetails(page) {
  let n = 3;
  let count = 0;
  const results = [];
  console.log("Entering the loop....");
  while (count < 500) {
    await autoScrollDown(page, mainScroll, 1000);
    console.log(n);
    const selector = businessSelector(n);
    const nameSelector = businessName();

    const exists = await page.waitForSelector(selector);
    if (!exists) {
      n++;
      continue;
    }
    const isActive = await page.evaluate((sel) => {
      return document.querySelector(sel).classList.contains("active");
    }, selector);

    if (!isActive) await page.click(selector);

    await page.waitForSelector(sideScrollContainer, { timeout: 1000 });

    const business = await getBussinesName(page, nameSelector);
    if (isDuplicateBusiness(business)) {
      console.log("This is a duplicate");
      continue;
    }

    const number = await getPhoneNumber(page);
    const venue = await getBussinesName(page, venueSelector);
    const website = await getWebsiteURL(page);
    const category = await getCartegory(page);
    const rating = await getRating(page);
    const ratingCount = await getRatingCount(page);
    count++;
    const cleanNumber = number ? number.replace(/\s+/g, "") : null;
    const formatted = cleanNumber ? cleanNumber.replace(/^0/, "+254") : null;
    numberList.add(formatted);
    n += 2;
    const result = {
      id: count,
      name: business || "",
      phone: formatted || "",
      location: venue || "",
      category: category || "",
      rating: rating || null,
      website: website || "",
      ratingCount: ratingCount || null,
    };

    results.push(result);
    console.log(business);

    if (results.length == 100) break;
  }

  return results;
}

async function getList() {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=site-per-process",
        "--lang=en-US",
        "--accept-lang=en-US,en;q=0.9",
        "--window-size=1920,1080", // Set window size for headless
      ],
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });
    // Navigate and wait for page to load
    console.log("Navigating to Google Maps...");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.screenshot({ path: "debug.png", fullPage: true });
    console.log("Screenshot saved as debug.png");
    console.log("Starting business details extraction...");
    const list = await getBusinessDetails(page);

    console.log(list);
    await browser.close();
     console.log(`Total businesses found :${list.length}`);
    return list;
  } catch (err) {
    console.error(err.message);
  }
 
}
getList();
export default getList;
