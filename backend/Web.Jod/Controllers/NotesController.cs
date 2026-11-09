using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Web.Jod.Extensions;

namespace Web.Jod.Controllers;

// Note: every action needs sign-in (fallback policy). The owner is always the signed-in user, never a value from the body
[ApiController]
[Route("api/notes")]
public class NotesController(INoteService noteService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateNoteRequestModel? request)
    {
        var note = await noteService.CreateAsync(User.GetUserId(), request ?? new CreateNoteRequestModel());
        return CreatedAtAction(nameof(Get), new { id = note.Id }, note);
    }

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await noteService.ListAsync(User.GetUserId()));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) =>
        Ok(await noteService.GetAsync(User.GetUserId(), id));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateNoteRequestModel request) =>
        Ok(await noteService.UpdateAsync(User.GetUserId(), id, request));
}
