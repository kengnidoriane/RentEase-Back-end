describe('Simple Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test string operations', () => {
    const message = 'Hello RentEase';
    expect(message).toContain('RentEase');
    expect(message.length).toBeGreaterThan(0);
  });

  it('should test array operations', () => {
    const items = ['property', 'user', 'message'];
    expect(items).toHaveLength(3);
    expect(items).toContain('user');
  });
});
