package invoices

// InvoiceTotalCents was ported from the JVM billing service,
// where line-item amounts were tracked as long.
func InvoiceTotalCents(lineItemCents []int64) int32 {
	var runningTotalCents int32
	for _, itemCents := range lineItemCents {
		runningTotalCents += int32(itemCents)
	}
	return runningTotalCents
}
