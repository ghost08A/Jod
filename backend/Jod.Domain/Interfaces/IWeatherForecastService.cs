using Jod.Domain.ViewModels;

namespace Jod.Domain.Interfaces;

public interface IWeatherForecastService
{
    IReadOnlyList<WeatherForecastViewModel> GetForecasts(int days);
}
