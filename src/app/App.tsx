import { useEffect, useState } from 'react'
import ConverterPage from '@/pages/converter'
import { createHistoryRecord, initialHistory, type HistoryRecord } from '@/entities/history-record'
import { convert, formatMoney, parseAmount } from '@/shared/lib/money'
import { DIGIT_KEYS, isDigitKey, type KeyId, type TabId } from '@/shared/lib/constants'

interface RatesResponse {
  base: string
  currencies: string[]
  rates: Record<string, string>
  updatedAt: string
}

interface Quote {
  quoteId: string
  from: string
  to: string
  rate: string
  amount: number
  createdAt: string
  expiresAt: string
}

export default function App() {
  const [tab, setTab] = useState<TabId>('exchange')
  const [amount, setAmount] = useState('0')
  const [from, setFrom] = useState('EUR')
  const [to, setTo] = useState('USD')
  const [currencies, setCurrencies] = useState<string[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [result, setResult] = useState('0')
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [history, setHistory] = useState<HistoryRecord[]>(initialHistory)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    fetch('/api/rates')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load rates: ${res.status}`)
        return res.json()
      })
      .then((data: RatesResponse) => {
        setCurrencies(data.currencies)
        setFrom(data.currencies[0])
        setTo(data.currencies[1])
      })
      .catch((err) => console.error(err))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, amount: parseAmount(amount).toNumber() }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Quote request failed: ${res.status}`)
        return res.json()
      })
      .then((data: Quote) => {
        setQuote(data)
        setResult(formatMoney(convert(amount, data.rate)))
        setLoading(false)
      })
      .catch((err) => console.error(err))
  }, [amount, from, to, refresh])

  function handleKey(id: KeyId) {
    if (isDigitKey(id)) {
      const char = DIGIT_KEYS[id] as string
      setAmount((prev) => (prev === '0' ? char : prev + char))
      return
    }

    switch (id) {
      case 'clear':
        if (tab === 'exchange') {
          setAmount('0')
        } else {
          setHistory([])
        }
        return
      case 'backspace':
        if (tab === 'exchange') {
          setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'))
        } else {
          setHistory((prev) => prev.filter((_, i) => i !== selected))
        }
        return
      case 'save':
        if (tab === 'exchange') {
          setHistory((prev) => [
            ...prev,
            createHistoryRecord({ from, to, amount, result: parseAmount(result).toString() }),
          ])
        }
        return
      case 'up':
        setSelected((prev) => Math.max(0, prev - 1))
        return
      case 'down':
        setSelected((prev) => Math.min(history.length - 1, prev + 1))
        return
      case 'ok': {
        const record = history[selected]
        if (record) {
          setFrom(record.from)
          setTo(record.to)
          setAmount(record.amount)
          setTab('exchange')
        }
        return
      }
      default:
        return
    }
  }

  return (
    <ConverterPage
      tab={tab}
      onTabChange={setTab}
      from={from}
      to={to}
      amount={amount}
      result={result}
      currencies={currencies}
      loading={loading}
      updatedAt={quote ? quote.createdAt : null}
      onFromChange={setFrom}
      onToChange={setTo}
      onRefresh={() => setRefresh((r) => r + 1)}
      history={history}
      selected={selected}
      onKey={handleKey}
    />
  )
}
