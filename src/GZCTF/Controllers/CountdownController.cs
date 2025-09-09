using GZCTF.Middlewares;
using GZCTF.Models.Internal;
using GZCTF.Models.Request.Countdown;
using GZCTF.Services.Cache;
using MemoryPack;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Distributed;
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
        var canvas = Decompress(data);

        // 转换为前端友好的JSON格式
        var jsonData = ConvertToJsonFormat(canvas);

        var countdown = new CanvasModel
        {
            StartTimeUtc = _config.StartTimeUtc,
            Width = _config.Width,
            Height = _config.Height,
            Data = jsonData
        };

        return Ok(countdown);
    }

    [RequireUser]
    [HttpGet("countdown/pixel/{x:int}/{y:int}/{value:bool}")]
    [EnableRateLimiting(nameof(RateLimiter.LimitPolicy.CountdownPutPixel))]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status200OK)]
    [Obsolete("Use UpdatePixelColor instead")]
    public async Task<IActionResult> UpdatePixel(
        [FromRoute] int x,
        [FromRoute] int y,
        [FromRoute] bool value,
        CancellationToken token
    )
    {
        // 保持向后兼容
        return await UpdatePixelColor(x, y, value ? "#FFFFFF" : "", token);
    }

    [RequireUser]
    [HttpPost("countdown/pixel/{x:int}/{y:int}")]
    [EnableRateLimiting(nameof(RateLimiter.LimitPolicy.CountdownPutPixel))]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(RequestResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePixelColor(
        [FromRoute] int x,
        [FromRoute] int y,
        [FromBody] string color,
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

        // 验证颜色格式
        if (!string.IsNullOrEmpty(color) && !IsValidHexColor(color))
        {
            return BadRequest(new RequestResponse("Invalid color format. Use hex format like #FF0000", StatusCodes.Status400BadRequest));
        }

        canvas[y][x] = color ?? "";
        await SetCanvas(canvas, token);
        return Ok(new RequestResponse("Pixel updated", StatusCodes.Status200OK));
    }

    private static bool IsValidHexColor(string color)
    {
        if (string.IsNullOrEmpty(color) || !color.StartsWith('#'))
            return false;
        
        if (color.Length != 7) // #RRGGBB
            return false;
            
        return color[1..].All(c => char.IsAsciiHexDigit(c));
    }

    private async Task<byte[]> GetCanvas(CancellationToken token)
    {
        var data = await _distributedCache.GetAsync(CacheKey.CountdownCanvas, token);
        if (data is null)
        {
            var newData = new string[_config.Height][];
            for (int i = 0; i < _config.Height; i++)
            {
                newData[i] = new string[_config.Width];
                for (int j = 0; j < _config.Width; j++)
                {
                    newData[i][j] = "";
                }
            }
            return Compress(newData);
        }

        return data;
    }

    private Task SetCanvas(byte[] data, CancellationToken token) =>
        _distributedCache.SetAsync(CacheKey.CountdownCanvas, data, new DistributedCacheEntryOptions { }, token);

    private Task SetCanvas(string[][] data, CancellationToken token) =>
        SetCanvas(Compress(data), token);

    private byte[] Compress(string[][] data)
    {
        using var memoryStream = new MemoryStream();
        return MemoryPackSerializer.Serialize(data);
    }

    private string[][] Decompress(byte[] compressedData)
    {
        try
        {
            // 尝试新格式（字符串数组）
            return MemoryPackSerializer.Deserialize<string[][]>(compressedData) ?? CreateEmptyCanvas();
        }
        catch
        {
            // 回退到旧格式（bool数组）进行向后兼容
            return ConvertFromLegacyFormat(compressedData);
        }
    }

    private string[][] ConvertFromLegacyFormat(byte[] compressedData)
    {
        var rows = _config.Height;
        var cols = _config.Width;

        string[][] result = new string[rows][];
        for (int i = 0; i < rows; i++)
        {
            result[i] = new string[cols];
        }

        int totalBits = rows * cols;
        int bitIndex = 0;

        for (int i = 0; i < rows; i++)
        {
            for (int j = 0; j < cols; j++)
            {
                if (bitIndex < totalBits && bitIndex / 8 < compressedData.Length)
                {
                    int bytePos = bitIndex / 8;
                    int bitPos = 7 - (bitIndex % 8);
                    bool isSet = (compressedData[bytePos] & (1 << bitPos)) != 0;
                    result[i][j] = isSet ? "#FFFFFF" : "";
                    bitIndex++;
                }
                else
                {
                    result[i][j] = "";
                }
            }
        }

        return result;
    }

    private string[][] CreateEmptyCanvas()
    {
        var newData = new string[_config.Height][];
        for (int i = 0; i < _config.Height; i++)
        {
            newData[i] = new string[_config.Width];
            for (int j = 0; j < _config.Width; j++)
            {
                newData[i][j] = "";
            }
        }
        return newData;
    }

    private string ConvertToJsonFormat(string[][] canvas)
    {
        try
        {
            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = false
            };
            var jsonString = JsonSerializer.Serialize(canvas, jsonOptions);
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(jsonString));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert canvas to JSON format");
            // 如果转换失败，返回空画布
            var emptyCanvas = CreateEmptyCanvas();
            var emptyJson = JsonSerializer.Serialize(emptyCanvas);
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(emptyJson));
        }
    }

    // 保留旧的压缩方法用于向后兼容
    [Obsolete("Use Compress(string[][]) instead")]
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
}