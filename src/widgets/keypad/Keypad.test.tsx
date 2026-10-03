import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Keypad from './Keypad'

describe('Keypad', () => {
  describe('Exchange tab', () => {
    it('renders digits, 00, dot, clear, backspace, save', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="100" onKey={() => {}} />,
      )
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByTestId(`key-${i}`)).toBeInTheDocument()
      }
      expect(screen.getByTestId('key-00')).toBeInTheDocument()
      expect(screen.getByTestId('key-dot')).toBeInTheDocument()
      expect(screen.getByTestId('key-clear')).toBeInTheDocument()
      expect(screen.getByTestId('key-backspace')).toBeInTheDocument()
      expect(screen.getByTestId('key-save')).toBeInTheDocument()
    })

    it('does not render up/down/ok (placeholders instead)', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="100" onKey={() => {}} />,
      )
      expect(screen.queryByTestId('key-up')).toBeNull()
      expect(screen.queryByTestId('key-down')).toBeNull()
      expect(screen.queryByTestId('key-ok')).toBeNull()
    })

    it('enables save when canSave and amount is non-zero', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="100" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-save')).not.toBeDisabled()
    })

    it('disables save when canSave is false', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={false} amount="100" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-save')).toBeDisabled()
    })

    it('disables save when amount is zero', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="0" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-save')).toBeDisabled()
    })

    it('calls onKey with the clicked key id for each key', async () => {
      const onKey = vi.fn()
      const user = userEvent.setup()
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="100" onKey={onKey} />,
      )
      await user.click(screen.getByTestId('key-7'))
      expect(onKey).toHaveBeenLastCalledWith('7')
      await user.click(screen.getByTestId('key-00'))
      expect(onKey).toHaveBeenLastCalledWith('00')
      await user.click(screen.getByTestId('key-dot'))
      expect(onKey).toHaveBeenLastCalledWith('dot')
      await user.click(screen.getByTestId('key-backspace'))
      expect(onKey).toHaveBeenLastCalledWith('backspace')
      await user.click(screen.getByTestId('key-clear'))
      expect(onKey).toHaveBeenLastCalledWith('clear')
      await user.click(screen.getByTestId('key-save'))
      expect(onKey).toHaveBeenLastCalledWith('save')
    })

    it('exposes aria-label="Backspace" on the backspace button', () => {
      render(
        <Keypad tab="exchange" historyEmpty={true} canSave={true} amount="100" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-backspace')).toHaveAttribute('aria-label', 'Backspace')
    })
  })

  describe('History tab', () => {
    it('renders up, down, ok, clear, backspace, save', () => {
      render(
        <Keypad tab="history" historyEmpty={false} canSave={false} amount="0" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-up')).toBeInTheDocument()
      expect(screen.getByTestId('key-down')).toBeInTheDocument()
      expect(screen.getByTestId('key-ok')).toBeInTheDocument()
      expect(screen.getByTestId('key-clear')).toBeInTheDocument()
      expect(screen.getByTestId('key-backspace')).toBeInTheDocument()
      expect(screen.getByTestId('key-save')).toBeInTheDocument()
    })

    it('still renders digit/00/dot keys but disables them', () => {
      render(
        <Keypad tab="history" historyEmpty={false} canSave={false} amount="0" onKey={() => {}} />,
      )
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByTestId(`key-${i}`)).toBeDisabled()
      }
      expect(screen.getByTestId('key-00')).toBeDisabled()
      expect(screen.getByTestId('key-dot')).toBeDisabled()
      expect(screen.getByTestId('key-save')).toBeDisabled()
    })

    it('enables up/down/ok/backspace/clear when history is not empty', () => {
      render(
        <Keypad tab="history" historyEmpty={false} canSave={false} amount="0" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-up')).not.toBeDisabled()
      expect(screen.getByTestId('key-down')).not.toBeDisabled()
      expect(screen.getByTestId('key-ok')).not.toBeDisabled()
      expect(screen.getByTestId('key-backspace')).not.toBeDisabled()
      expect(screen.getByTestId('key-clear')).not.toBeDisabled()
    })

    it('disables up/down/ok/backspace/clear when history is empty', () => {
      render(
        <Keypad tab="history" historyEmpty={true} canSave={false} amount="0" onKey={() => {}} />,
      )
      expect(screen.getByTestId('key-up')).toBeDisabled()
      expect(screen.getByTestId('key-down')).toBeDisabled()
      expect(screen.getByTestId('key-ok')).toBeDisabled()
      expect(screen.getByTestId('key-backspace')).toBeDisabled()
      expect(screen.getByTestId('key-clear')).toBeDisabled()
    })

    it('calls onKey with the right ids on the history tab', async () => {
      const onKey = vi.fn()
      const user = userEvent.setup()
      render(<Keypad tab="history" historyEmpty={false} canSave={false} amount="0" onKey={onKey} />)
      await user.click(screen.getByTestId('key-up'))
      expect(onKey).toHaveBeenLastCalledWith('up')
      await user.click(screen.getByTestId('key-down'))
      expect(onKey).toHaveBeenLastCalledWith('down')
      await user.click(screen.getByTestId('key-ok'))
      expect(onKey).toHaveBeenLastCalledWith('ok')
    })
  })
})
