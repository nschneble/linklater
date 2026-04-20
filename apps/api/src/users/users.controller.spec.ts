import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findById: jest.fn(),
    updateMe: jest.fn(),
    deleteById: jest.fn(),
  } as unknown as UsersService;

  const makeReq = (userId = 'user-1') => ({ user: { userId } } as never);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe delegates to UsersService.findById with userId from request', async () => {
    const user = { id: 'user-1', email: 'a@b.com' };
    (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);

    const result = await controller.getMe(makeReq());

    expect(usersServiceMock.findById).toHaveBeenCalledWith('user-1');
    expect(result).toBe(user);
  });

  it('updateMe delegates to UsersService.updateMe with userId from request', async () => {
    const updated = { id: 'user-1', email: 'new@b.com' };
    (usersServiceMock.updateMe as jest.Mock).mockResolvedValue(updated);

    const result = await controller.updateMe(makeReq(), { email: 'new@b.com' } as never);

    expect(usersServiceMock.updateMe).toHaveBeenCalledWith('user-1', { email: 'new@b.com' });
    expect(result).toBe(updated);
  });

  it('deleteMe delegates to UsersService.deleteById and returns success', async () => {
    (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.deleteMe(makeReq());

    expect(usersServiceMock.deleteById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ success: true });
  });
});
