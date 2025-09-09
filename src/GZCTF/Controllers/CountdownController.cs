using GZCTF.Middlewares;
using GZCTF.Models.Internal;
using GZCTF.Models.Request.Countdown;
using GZCTF.Services.Cache;
using MemoryPack;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json;

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
            Data = data,
        };

        return Ok(countdown);
    }

    [RequireUser]
    [HttpGet("countdown/pixel/{x:int}/{y:int}/{color}")]
    // [EnableRateLimiting(nameof(RateLimiter.LimitPolicy.CountdownPutPixel))]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePixelColor(
        [FromRoute] int x,
        [FromRoute] int y,
        [FromRoute] string color,
        CancellationToken token
    )
    {
        if (!_config.Enable)
        {
            return NotFound(new RequestResponse("Countdown is disabled", StatusCodes.Status404NotFound));
        }

        var canvas = await GetCanvas(token);
        if (x < 0 || x >= _config.Width || y < 0 || y >= _config.Height)
        {
            return BadRequest(new RequestResponse("Coordinates out of bounds", StatusCodes.Status400BadRequest));
        }

        if (!ColorHelper.IsValidHexColor(color))
        {
            return BadRequest(new RequestResponse("Invalid color format. Use hex format like #FF0000", StatusCodes.Status400BadRequest));
        }

        await SetColor(x, y, color, canvas, token);

        return Ok(new RequestResponse("Pixel updated", StatusCodes.Status200OK));
    }

    private Task SetColor(int x, int y, string color, Dictionary<string, string> canvas, CancellationToken token = default)
    {
        var key = $"{x}:{y}";

        if (String.IsNullOrEmpty(color) || color == "000000")
        {
            canvas.Remove(key);
        }
        else
        {
            canvas[key] = color;
        }

        return SetCanvas(canvas, token);
    }

    private async Task<Dictionary<string, string>> GetCanvas(CancellationToken token)
    {
        var data = await _distributedCache.GetAsync(CacheKey.CountdownCanvas, token);
        if (data is null)
        {
            var empty = CreateEmptyCanvas();
            await SetCanvas(empty, token);
            return empty;
        }

        return MemoryPackSerializer.Deserialize<Dictionary<string, string>>(data) ?? CreateEmptyCanvas();
    }

    private Task SetCanvas(Dictionary<string, string> data, CancellationToken token) =>
        _distributedCache.SetAsync(CacheKey.CountdownCanvas, MemoryPackSerializer.Serialize(data), new DistributedCacheEntryOptions { }, token);


    private static Dictionary<string, string> CreateEmptyCanvas() => [];

    private class ColorHelper
    {
        public static bool IsValidHexColor(string color)
        {
            if (string.IsNullOrEmpty(color))
                return false;

            if (color.Length != 6) // RRGGBB
                return false;

            return color.All(c => char.IsAsciiHexDigit(c));
        }

    }
}