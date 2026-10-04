from fastapi import FastAPI, HTTPException, Query
import httpx

app = FastAPI(
    title="Web Page Fetcher",
    description="A simple microservice that downloads and returns the content of a given URL.",
    version="1.0.0",
)


@app.get("/fetch")
async def fetch_url(url: str = Query(..., description="The full URL to fetch")):
    """Endpoint that takes a URL, downloads the page, and returns the HTML content."""
    # Basic validation
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL format. Must start with http:// or https://",
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        # Asynchronously fetch the URL with a timeout of 10 seconds and follow redirects
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, headers=headers, timeout=10.0)

            return {
                "url": str(response.url),
                "status_code": response.status_code,
                "content": response.text,
            }

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, detail="The request to the target URL timed out."
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502, detail=সাধু "Failed to fetch the URL. Error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # Run the server on localhost, port 8000
    uvicorn.run("fetcher:app", host="127.0.0.1", port=8000, reload=True)
