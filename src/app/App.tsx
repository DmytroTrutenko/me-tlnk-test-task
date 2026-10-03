import ConverterPage from '@/pages/converter'
import { useConverter } from '@/pages/converter/model'

export default function App() {
  const {
    tab,
    amount,
    from,
    to,
    result,
    resultState,
    currencies,
    currenciesLoading,
    currenciesError,
    ageLabel,
    history,
    selected,
    canSave,
    setTab,
    setFrom,
    setTo,
    refreshQuote,
    retryCurrencies,
    applyKey,
  } = useConverter()

  return (
    <ConverterPage
      tab={tab}
      onTabChange={setTab}
      from={from}
      to={to}
      amount={amount}
      result={result}
      resultState={resultState}
      currencies={currencies}
      currenciesLoading={currenciesLoading}
      currenciesError={currenciesError}
      onRetryCurrencies={retryCurrencies}
      ageLabel={ageLabel}
      onFromChange={setFrom}
      onToChange={setTo}
      onRefresh={refreshQuote}
      history={history}
      selected={selected}
      onKey={applyKey}
      canSave={canSave}
    />
  )
}
