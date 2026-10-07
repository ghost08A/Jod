using Jod.Domain;
using Jod.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Web.Jod.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WeatherForecastController(IWeatherForecastService service) : ControllerBase
{
    [HttpGet(Name = "GetWeatherForecast")]
    public IActionResult Get(int days = 5)
    {
        try
        {
            return Ok(service.GetForecasts(days));
        }
        catch (CustomError ex)
        {
            return BadRequest(new { messages = ex.Messages });
        }
    }
}
