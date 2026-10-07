import { useWeatherForecasts } from '../hooks/useWeatherForecasts'
import { formatTemperature } from '../utils/format-temperature'

export function WeatherPage() {
    const { forecasts, errorMessage } = useWeatherForecasts()

    if (errorMessage) return <p role="alert">{errorMessage}</p>
    if (!forecasts) return <p aria-busy="true">Loading…</p>

    return (
        <table>
            <thead>
                <tr><th>Date</th><th>Temp</th><th>Summary</th></tr>
            </thead>
            <tbody>
                {forecasts.map((forecast) => (
                    <tr key={forecast.date}>
                        <td>{forecast.date}</td>
                        <td>{formatTemperature(forecast.temperatureC)}</td>
                        <td>{forecast.summary}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
