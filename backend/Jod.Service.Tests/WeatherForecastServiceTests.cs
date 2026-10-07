using Jod.Domain;
using Jod.Service.ImplementServices;

namespace Jod.Service.Tests;

public class WeatherForecastServiceTests
{
    private readonly WeatherForecastService _sut = new();

    [Fact]
    public void GetForecasts_ValidDays_ReturnsThatManyItems()
    {
        var result = _sut.GetForecasts(3);

        Assert.Equal(3, result.Count);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(15)]
    public void GetForecasts_DaysOutOfRange_ThrowsCustomError(int days)
    {
        Assert.Throws<CustomError>(() => _sut.GetForecasts(days));
    }
}
