import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.goto(url, { waitUntil: 'networkidle2' });

  const pageContent = await page.content();

  // Detect platform
  const isInstagram = url.includes('instagram.com');
  const isFacebook = url.includes('facebook.com');

  // Detect post or page
  const isPost = url.includes('/p/') || url.includes('/posts/') || url.includes('/reel/') || url.includes('/photo.php');

  let data = { platform: isInstagram ? 'Instagram' : 'Facebook', type: isPost ? 'post' : 'page' };

  try {
    if (isInstagram && isPost) {
      // Instagram Post: extract title, like/comment from meta (simplified)
      const title = await page.$eval('meta[property="og:title"]', el => el.content);
      const desc = await page.$eval('meta[property="og:description"]', el => el.content);
      data.title = title;
      data.description = desc;
    } else if (isInstagram && !isPost) {
      // Instagram Page: try to extract follower count (simplified)
      const desc = await page.$eval('meta[property="og:description"]', el => el.content);
      data.description = desc;
    } else if (isFacebook && isPost) {
      // Facebook Post: extract og:title and og:description
      const title = await page.$eval('meta[property="og:title"]', el => el.content);
      const desc = await page.$eval('meta[property="og:description"]', el => el.content);
      data.title = title;
      data.description = desc;
    } else if (isFacebook && !isPost) {
      // Facebook Page: extract og:description or other metadata
      const desc = await page.$eval('meta[property="og:description"]', el => el.content);
      data.description = desc;
    }
  } catch (error) {
    data.error = 'Some content could not be extracted. It may be private or protected.';
  }

  await browser.close();
  res.status(200).json(data);
}
