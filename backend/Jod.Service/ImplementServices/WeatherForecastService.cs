using Jod.Domain;
using Jod.Domain.Interfaces;
using Jod.Domain.ViewModels;

namespace Jod.Service.ImplementServices;

public class WeatherForecastService : IWeatherForecastService
{
    private static readonly string[] Summaries =
    [
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    ];

    public IReadOnlyList<WeatherForecastViewModel> GetForecasts(int days)
    {
        if (days is < 1 or > 14) throw new CustomError("days must be between 1 and 14.");

        return Enumerable.Range(1, days).Select(index => new WeatherForecastViewModel
        {
            Date = DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            TemperatureC = Random.Shared.Next(-20, 55),
            Summary = Summaries[Random.Shared.Next(Summaries.Length)]
        }).ToArray();
    }
}
