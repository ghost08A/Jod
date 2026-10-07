import { getJson } from '../../../core/http/http-client'
import type { WeatherForecast } from '../types/weather-forecast'

export function fetchWeatherForecasts(): Promise<WeatherForecast[]> {
    return getJson<WeatherForecast[]>('/api/WeatherForecast')
}
