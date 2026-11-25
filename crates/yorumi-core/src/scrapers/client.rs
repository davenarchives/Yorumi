use std::time::Duration;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use reqwest::Client;
use crate::scrapers::error::ScraperError;

const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

#[derive(Clone, Debug)]
pub struct ScraperClient {
    client: Client,
    user_agent: String,
}

impl ScraperClient {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(DEFAULT_USER_AGENT),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"),
        );
        headers.insert(
            ACCEPT_LANGUAGE,
            HeaderValue::from_static("en-US,en;q=0.9"),
        );

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(10))
            .tcp_nodelay(true)
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(24)
            .build()
            .expect("Failed to build HTTP client for scraper engine");

        Self {
            client,
            user_agent: DEFAULT_USER_AGENT.to_string(),
        }
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn user_agent(&self) -> &str {
        &self.user_agent
    }

    pub async fn get_html(&self, url: &str, referer: Option<&str>) -> Result<String, ScraperError> {
        let mut req = self.client.get(url);
        if let Some(ref_url) = referer {
            req = req.header("Referer", ref_url);
        }

        let resp = req.send().await?;
        let status = resp.status();
        if !status.is_success() {
            if status.as_u16() == 403 || status.as_u16() == 429 {
                return Err(ScraperError::RateLimited(format!("Status {} for {}", status, url)));
            }
            return Err(ScraperError::NotFound(format!("Status {} for {}", status, url)));
        }

        let body = resp.text().await?;
        Ok(body)
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str, referer: Option<&str>) -> Result<T, ScraperError> {
        let mut req = self.client.get(url);
        if let Some(ref_url) = referer {
            req = req.header("Referer", ref_url);
        }

        let resp = req.send().await?;
        let data = resp.json::<T>().await?;
        Ok(data)
    }
}

impl Default for ScraperClient {
    fn default() -> Self {
        Self::new()
    }
}

