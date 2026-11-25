use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScraperError {
    #[error("Network request failed: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Failed to parse HTML or data: {0}")]
    Parse(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Failed to extract streams: {0}")]
    StreamExtraction(String),

    #[error("Decryption error: {0}")]
    Decryption(String),

    #[error("Rate limited or blocked: {0}")]
    RateLimited(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl serde::Serialize for ScraperError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

