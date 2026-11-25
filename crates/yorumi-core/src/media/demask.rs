/// Strips PNG disguise headers from disguised MPEG-TS video segments.
///
/// Certain anime providers disguise `.ts` chunks with a fake PNG image header (`0x89 0x50 0x4E 0x47`).
/// This function verifies if the buffer begins with PNG magic bytes and scans for the triple MPEG-TS sync
/// byte pattern (`0x47` separated by 188-byte packet boundaries).
pub fn demask_mpegts(data: &[u8]) -> &[u8] {
    if data.len() < 8 {
        return data;
    }

    // Check PNG magic: 0x89 0x50 0x4E 0x47 ('\x89PNG')
    if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
        let limit = data.len().saturating_sub(376);
        for i in 0..limit {
            if data[i] == 0x47 && data[i + 188] == 0x47 && data[i + 376] == 0x47 {
                return &data[i..];
            }
        }
    }

    data
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_data_untouched() {
        let ts_chunk = vec![0x47, 0x00, 0x10, 0x20];
        assert_eq!(demask_mpegts(&ts_chunk), ts_chunk.as_slice());
    }

    #[test]
    fn test_png_masked_data_stripped() {
        let mut buffer = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]; // PNG header
        buffer.extend(vec![0x00; 100]); // Some fake PNG chunk bytes
        let sync_offset = buffer.len();
        // Append valid MPEG-TS sync pattern (0x47 at 0, 188, 376)
        buffer.extend(vec![0x47; 1]);
        buffer.extend(vec![0x00; 187]);
        buffer.extend(vec![0x47; 1]);
        buffer.extend(vec![0x00; 187]);
        buffer.extend(vec![0x47; 1]);
        buffer.extend(vec![0xAA; 50]);

        let result = demask_mpegts(&buffer);
        assert_eq!(result.len(), buffer.len() - sync_offset);
        assert_eq!(result[0], 0x47);
        assert_eq!(result[188], 0x47);
        assert_eq!(result[376], 0x47);
    }
}

