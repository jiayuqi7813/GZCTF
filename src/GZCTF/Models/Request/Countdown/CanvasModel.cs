namespace GZCTF.Models.Request.Countdown;

public class CanvasModel
{
    public DateTimeOffset StartTimeUtc { get; set; }
    public Dictionary<string, string> Data { get; set; } = [];
    public int Width { get; set; }
    public int Height { get; set; }
}
