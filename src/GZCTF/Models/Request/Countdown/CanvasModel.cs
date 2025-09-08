namespace GZCTF.Models.Request.Countdown;

public class CanvasModel
{
    public DateTimeOffset StartTimeUtc { get; set; }
    public string Data { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
}
