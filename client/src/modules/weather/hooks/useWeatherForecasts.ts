import { useEffect, useState } from 'react'
import { fetchWeatherForecasts } from '../services/weather-service'
import type { WeatherForecast } from '../types/weather-forecast'

export function useWeatherForecasts() {
    const [forecasts, setForecasts] = useState<WeatherForecast[] | undefined>(undefined)
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

    useEffect(() => {
        fetchWeatherForecasts()
            .then(setForecasts)
            .catch((err: unknown) =>
                setErrorMessage(err instanceof Error ? err.message : 'Failed to load forecasts'),
            )
    }, [])

    return { forecasts, errorMessage }
}
