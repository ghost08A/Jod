using Microsoft.EntityFrameworkCore;
using Web.Jod.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddDbContext<Jod.Service.Data.JodDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not set (see appsettings.Development.example.json).")));
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = ErrorResponses.ThrowForInvalidModelState);
builder.Services.AddScoped<Jod.Domain.Interfaces.IWeatherForecastService, Jod.Service.ImplementServices.WeatherForecastService>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Note: must stay first so it can answer for every other middleware
app.UseMiddleware<ApiExceptionHandler>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Note: lets the integration tests start the app with WebApplicationFactory<Program>
public partial class Program;
