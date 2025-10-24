import { MessageService } from '../services/message.service';
import { MessageRepository } from '../repositories/message.repository';

// Simple test to verify messaging system structure
describe('Message System Simple Test', () => {
  it('should have MessageService class', () => {
    expect(MessageService).toBeDefined();
    expect(typeof MessageService).toBe('function');
  });

  it('should have MessageRepository class', () => {
    expect(MessageRepository).toBeDefined();
    expect(typeof MessageRepository).toBe('function');
  });

  it('should create MessageService instance', () => {
    const mockPrisma = {} as any;
    const messageService = new MessageService(mockPrisma);
    expect(messageService).toBeInstanceOf(MessageService);
  });

  it('should create MessageRepository instance', () => {
    const mockPrisma = {} as any;
    const messageRepository = new MessageRepository(mockPrisma);
    expect(messageRepository).toBeInstanceOf(MessageRepository);
  });
});