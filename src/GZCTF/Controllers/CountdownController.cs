using GZCTF.Middlewares;
using GZCTF.Models.Internal;
using GZCTF.Models.Request.Countdown;
using GZCTF.Services.Cache;
using MemoryPack;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Distributed;

namespace GZCTF.Controllers;

/// <summary>
/// Countdown APIs
/// </summary>
[Route("api")]
[ApiController]
public class CountdownController(
    ILogger<CountdownController> logger,
    IConfiguration configuration,
    IDistributedCache distributedCache
    ) : ControllerBase
{
    readonly ILogger<CountdownController> _logger = logger;
    readonly CountdownConfig _config = configuration.GetSection(nameof(CountdownConfig)).Get<CountdownConfig>() ??
                     new();
    readonly IDistributedCache _distributedCache = distributedCache;

    [HttpGet("countdown")]
    [ProducesResponseType(typeof(CanvasModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCountdown(
        CancellationToken token
    )
    {
        if (!_config.Enable)
        {
            return NotFound(new RequestResponse("Countdown is disabled", StatusCodes.Status404NotFound));
        }

        var data = await GetCanvas(token);

        var countdown = new CanvasModel
        {
            StartTimeUtc = _config.StartTimeUtc,
            Width = _config.Width,
            Height = _config.Height,
            Data = Base64UrlTextEncoder.Encode(data)
        };

        return Ok(countdown);
    }

    [RequireUser]
    [HttpGet("countdown/pixel/{x:int}/{y:int}/{value:bool}")]
    [EnableRateLimiting(nameof(RateLimiter.LimitPolicy.CountdownPutPixel))]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePixel(
        [FromRoute] int x,
        [FromRoute] int y,
        [FromRoute] bool value,
        CancellationToken token
    )
    {
        if (!_config.Enable)
        {
            return NotFound(new RequestResponse("Countdown is disabled", StatusCodes.Status404NotFound));
        }

        var data = await GetCanvas(token);
        var canvas = Decompress(data);
        if (x < 0 || x >= _config.Width || y < 0 || y >= _config.Height)
        {
            return BadRequest(new RequestResponse("Coordinates out of bounds", StatusCodes.Status400BadRequest));
        }

        canvas[y][x] = value;
        await SetCanvas(canvas, token);
        return Ok(new RequestResponse("Pixel updated", StatusCodes.Status200OK));
    }

    private async Task<byte[]> GetCanvas(CancellationToken token)
    {
        var data = await _distributedCache.GetAsync(CacheKey.CountdownCanvas, token);
        if (data is null)
        {
            var newData = new bool[_config.Height][];
            for (int i = 0; i < _config.Height; i++)
            {
                newData[i] = new bool[_config.Width];
            }
            return Compress(newData);
        }

        return data;
    }

    private Task SetCanvas(byte[] data, CancellationToken token) =>
        _distributedCache.SetAsync(CacheKey.CountdownCanvas, data, new DistributedCacheEntryOptions { }, token);

    private Task SetCanvas(bool[][] data, CancellationToken token) =>
        SetCanvas(Compress(data), token);

    private byte[] Compress(bool[][] data)
    {
        int rows = data.Length;
        int cols = rows > 0 ? data[0].Length : 0;
        int totalBits = rows * cols;
        int byteCount = (totalBits + 7) / 8;
        byte[] result = new byte[byteCount];
        int bitIndex = 0;

        for (int i = 0; i < rows; i++)
        {
            for (int j = 0; j < cols; j++)
            {
                if (data[i][j])
                {
                    int bytePos = bitIndex / 8;
                    int bitPos = 7 - (bitIndex % 8);
                    result[bytePos] |= (byte)(1 << bitPos);
                }
                bitIndex++;
            }
        }

        return result;
    }

    private bool[][] Decompress(byte[] compressedData)
    {
        var rows = _config.Height;
        var cols = _config.Width;

        bool[][] result = new bool[rows][];
        for (int i = 0; i < rows; i++)
        {
            result[i] = new bool[cols];
        }

        int totalBits = rows * cols;
        int bitIndex = 0;

        for (int i = 0; i < rows; i++)
        {
            for (int j = 0; j < cols; j++)
            {
                if (bitIndex < totalBits)
                {
                    int bytePos = bitIndex / 8;
                    int bitPos = 7 - (bitIndex % 8);
                    result[i][j] = (compressedData[bytePos] & (1 << bitPos)) != 0;
                    bitIndex++;
                }
            }
        }

        return result;
    }
}