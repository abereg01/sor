type Props = {
  message: string;
  onReload: () => void;
};

export function ConcurrencyError({ message, onReload }: Props) {
  return (
    <div className="ui-alert ui-alert-warning">
      <p className="ui-alert-title">Ändringen kunde inte sparas</p>
      <p className="ui-alert-text">{message}</p>

      <button type="button" className="ui-button ui-button-warning" onClick={onReload}>
        Ladda om objektet
      </button>
    </div>
  );
}
